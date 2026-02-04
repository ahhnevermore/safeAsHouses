import { Room } from "../game/room.js";
import type { RedisClientType } from "redis";
import { Player } from "../game/player.js";
import { Deck } from "../game/deck.js";
import { Board } from "../game/board.js";
import { Card } from "../game/util.js";
import { type Server } from "socket.io";
import { type ClientEvents, type ServerEvents } from "../game/events.js";
import { type Logger } from "winston";
import { ID, roomID } from "../game/types.js";
import { TimerManager } from "./timer.js";

interface SerializedRoom {
  id: string;
  pot: number;
  actIndex: number;
  round: number;
  players: ReturnType<Player["toJSON"]>[];
  deck: ReturnType<Deck["toJSON"]>;
  board: ReturnType<Board["toJSON"]>;
}

export function serializeRoomState(room: Room): string {
  const data: SerializedRoom = {
    id: room.id,
    pot: room.pot,
    actIndex: room.actIndex,
    round: room.round,
    players: room.players.map((p) => p.toJSON()),
    deck: room.deck.toJSON(),
    board: room.board.toJSON(),
  };
  return JSON.stringify(data);
}

export function deserializeRoomState(
  json: string,
  io: Server<ClientEvents, ServerEvents>,
  logger: Logger,
  timerManager: TimerManager,
): Room {
  const data: SerializedRoom = JSON.parse(json);

  // Create a new Room instance without the default constructor logic
  const room = new Room(io, logger, timerManager, false);

  // Re-hydrate the state
  room.id = data.id as roomID;
  room.pot = data.pot;
  room.actIndex = data.actIndex;
  room.round = data.round || 0;
  room.deck = Deck.fromJSON(data.deck);
  room.board = Board.fromJSON(data.board);

  // Re-hydrate players
  room.players = data.players.map((playerData) => {
    const player = new Player(playerData.id as ID, playerData.name, playerData.publicID);
    player.coins = playerData.coins;
    player.hand = playerData.hand.map((key) => Card.fromKey(key));
    return player;
  });

  return room;
}

export async function saveRoomState(redis: RedisClientType<any>, room: Room): Promise<void> {
  const serialized = serializeRoomState(room);
  // Store with 24-hour expiration (prevents orphaned rooms)
  await redis.set(room.id, serialized, { EX: 86400 });
}

export async function loadRoom(
  redis: RedisClientType<any>,
  roomId: roomID,
  io: Server<ClientEvents, ServerEvents>,
  logger: Logger,
  timerManager: TimerManager,
): Promise<Room | null> {
  const json = await redis.get(roomId);
  if (!json) {
    return null;
  }
  return deserializeRoomState(json, io, logger, timerManager);
}
