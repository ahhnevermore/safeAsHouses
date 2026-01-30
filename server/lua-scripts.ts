// ZSET for matchmaking rooms with available slots. Score = player count.
export const WAITING_ROOMS_ZSET = "waitingRooms";
export const USER_TO_ROOM_PREFIX = "userToRoom:";

// Lua script: Atomically checks for reconnect, finds/creates a room, and maps the user to it.
// Returns: {'RECONNECT', roomId} OR {'MATCH', roomId, newPlayerCount}
// KEYS[1]: waiting_rooms_zset
// ARGV[1]: max_players
// ARGV[2]: userId
// ARGV[3]: userToRoom_prefix
// ARGV[4]: newRoomId (only used if creating a new room)
export const MATCH_USER_LUA = `
  local zset_key = KEYS[1]
  local max_players = tonumber(ARGV[1])
  local user_id = ARGV[2]
  local user_to_room_prefix = ARGV[3]
  local new_room_id = ARGV[4]

  -- 1. Check if user is already in a room
  local user_to_room_key = user_to_room_prefix .. user_id
  local existing_room_id = redis.call('get', user_to_room_key)
  if existing_room_id then
    return {'RECONNECT', existing_room_id}
  end

  -- 2. Find or create a room
  local room_data = redis.call('zrevrangebyscore', zset_key, max_players - 1, 1, 'LIMIT', 0, 1)
  local room_id
  local new_score
  if #room_data > 0 then
    room_id = room_data[1]
    new_score = redis.call('zincrby', zset_key, 1, room_id)
    if tonumber(new_score) >= max_players then
      redis.call('zrem', zset_key, room_id)
    end
  else
    -- No waiting rooms, use the pre-generated ID from the application.
    room_id = new_room_id
    redis.call('zadd', zset_key, 1, room_id)
    new_score = 1
  end

  -- 3. Set the user's room mapping
  redis.call('set', user_to_room_key, room_id)

  return {'MATCH', room_id, tostring(new_score)}
`;
