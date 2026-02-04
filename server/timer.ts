import { createClient, RedisClientType } from "redis";
import { Logger } from "winston";
import { roomID } from "../game/types.js";
import { EventEmitter } from "events";
import { GAME_ABANDON_TIMER_SECONDS, TURN_TIMER_ACTION_SECONDS, TURN_TIMER_MAIN_SECONDS } from "../game/util.js";


export const TURN_MAIN_PREFIX = "turn-timer:main:";
export const TURN_ACTION_PREFIX = "turn-timer:action:";
export const GAME_ABANDON_PREFIX = "game-timer:abandon:";

export class TimerManager extends EventEmitter {
  private redisClient: RedisClientType;
  private subscriber: RedisClientType;
  private logger: Logger;
  private isExecutor: boolean;
  private isListener: boolean;

  constructor(
    redisUrl: string,
    logger: Logger,
    roles: { isExecutor: boolean; isListener: boolean },
  ) {
    super();
    this.isExecutor = roles.isExecutor;
    this.isListener = roles.isListener;
    this.redisClient = createClient({ url: redisUrl });
    this.subscriber = this.redisClient.duplicate();
    this.logger = logger;
  }

  public async initialize() {
    const promises: Promise<any>[] = [];
    if (this.isExecutor) {
      promises.push(this.redisClient.connect());
    }
    if (this.isListener) {
      promises.push(this.subscriber.connect());
    }
    await Promise.all(promises);

    // Listeners need to subscribe to events.
    if (this.isListener) {
      // Listeners also need a command client to set config.
      const cmdClient = this.isExecutor ? this.redisClient : this.redisClient.duplicate();
      if (!this.isExecutor) await cmdClient.connect();

      await cmdClient.configSet("notify-keyspace-events", "Ex");
      
      if (!this.isExecutor) await cmdClient.quit();

      // Subscribe to the keyspace channel for expired keys
      this.subscriber.subscribe("__keyevent@0__:expired", (key) => {
        this.logger.debug(`Received expired key event for: ${key}`);

        let roomId: roomID | null = null;

        if (key.startsWith(TURN_MAIN_PREFIX)) {
          roomId = key.substring(TURN_MAIN_PREFIX.length) as roomID;
          this.emit("turnTimerExpired", roomId);
        } else if (key.startsWith(TURN_ACTION_PREFIX)) {
          roomId = key.substring(TURN_ACTION_PREFIX.length) as roomID;
          this.emit("turnTimerExpired", roomId);
        } else if (key.startsWith(GAME_ABANDON_PREFIX)) {
          roomId = key.substring(GAME_ABANDON_PREFIX.length) as roomID;
          this.emit("gameAbandonTimerExpired", roomId);
        }
      });
      this.logger.info("TimerManager subscribed to key expiration events.");
    }
  }

  public async startTurnTimers(roomId: roomID): Promise<void> {
    const mainKey = `${TURN_MAIN_PREFIX}${roomId}`;
    const actionKey = `${TURN_ACTION_PREFIX}${roomId}`;
    await this.redisClient
      .multi()
      .set(mainKey, "active", { EX: TURN_TIMER_MAIN_SECONDS })
      .set(actionKey, "active", { EX: TURN_TIMER_ACTION_SECONDS })
      .exec();
    this.logger.debug(`Started main and action timers for room ${roomId}`);
  }

  public async initializeGameTimers(roomId: roomID): Promise<void> {
    const abandonKey = `${GAME_ABANDON_PREFIX}${roomId}`;
    const mainKey = `${TURN_MAIN_PREFIX}${roomId}`;
    const actionKey = `${TURN_ACTION_PREFIX}${roomId}`;

    // Use a pipeline to set all three initial timers in one network round-trip.
    await this.redisClient
      .multi()
      .set(abandonKey, "active", { EX: GAME_ABANDON_TIMER_SECONDS })
      .set(mainKey, "active", { EX: TURN_TIMER_MAIN_SECONDS })
      .set(actionKey, "active", { EX: TURN_TIMER_ACTION_SECONDS })
      .exec();

    this.logger.debug(`Initialized all game start timers for room ${roomId}`);
  }

  public async saveRoomBumpAction(roomId: roomID, serializedRoomState: string): Promise<void> {
    const actionTimerKey = `${TURN_ACTION_PREFIX}${roomId}`;

    await this.redisClient
      .multi()
      .expire(actionTimerKey, TURN_TIMER_ACTION_SECONDS)
      .set(roomId, serializedRoomState, { EX: 86400 }) // 24-hour TTL for game state
      .exec();
    this.logger.debug(`Reset action timer and saved state for room ${roomId}`);
  }

  public async saveRoomBumpTurn(roomId: roomID, serializedRoomState: string): Promise<void> {
    const mainKey = `${TURN_MAIN_PREFIX}${roomId}`;
    const actionKey = `${TURN_ACTION_PREFIX}${roomId}`;

    await this.redisClient
      .multi()
      // Delete old timers
      .del([mainKey, actionKey])
      // Set new timers
      .set(mainKey, "active", { EX: TURN_TIMER_MAIN_SECONDS })
      .set(actionKey, "active", { EX: TURN_TIMER_ACTION_SECONDS })
      // Save the new room state
      .set(roomId, serializedRoomState, { EX: 86400 })
      .exec();

    this.logger.debug(`Advanced turn timers and saved state for room ${roomId}`);
  }

  async close(): Promise<void> {
    const promises: Promise<any>[] = [];
    if (this.isExecutor) {
      promises.push(this.redisClient.quit());
    }
    if (this.isListener) {
      promises.push(this.subscriber.quit());
    }
    try {
      await Promise.all(promises);
      this.logger.info("Redis connections closed.");
    } catch (err) {
      this.logger.error("Error closing Redis connections:", err);
    }
  }
}
