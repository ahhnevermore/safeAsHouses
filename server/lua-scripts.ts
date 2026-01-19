// ZSET for matchmaking rooms with available slots. Score = player count.
export const WAITING_ROOMS_ZSET = "waitingRooms";
export const USER_TO_ROOM_PREFIX = "userToRoom:";
export const USER_SOCKETS_PREFIX = "userSockets:";

// Lua script: Atomically checks for reconnect, finds/creates a room, and maps the user to it.
// Returns: {'RECONNECT', roomId, socketIds} OR {'MATCH', roomId, newPlayerCount, socketIds}
// KEYS[1]: waiting_rooms_zset
// ARGV[1]: max_players
// ARGV[2]: userId
// ARGV[3]: userToRoom_prefix
// ARGV[4]: userSockets_prefix
export const MATCH_USER_LUA = `
  local zset_key = KEYS[1]
  local max_players = tonumber(ARGV[1])
  local user_id = ARGV[2]
  local user_to_room_prefix = ARGV[3]
  local user_sockets_prefix = ARGV[4]

  local user_sockets_key = user_sockets_prefix .. user_id
  local socket_ids = redis.call('smembers', user_sockets_key)

  -- 1. Check if user is already in a room
  local user_to_room_key = user_to_room_prefix .. user_id
  local existing_room_id = redis.call('get', user_to_room_key)
  if existing_room_id then
    return {'RECONNECT', existing_room_id, socket_ids}
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
    room_id = 'room:' .. redis.call('time')[1] .. '-' .. math.random(1000, 9999)
    redis.call('zadd', zset_key, 1, room_id)
    new_score = 1
  end

  -- 3. Set the user's room mapping
  redis.call('set', user_to_room_key, room_id)

  return {'MATCH', room_id, tostring(new_score), socket_ids}
`;

// Lua script: Gets the room data for a given user ID, if it exists.
// ARGV[1]: user_id
// ARGV[2]: user_to_room_prefix
export const GET_ROOM_BY_USER_ID_LUA = `
  local user_id = ARGV[1]
  local user_to_room_prefix = ARGV[2]
  local user_to_room_key = user_to_room_prefix .. user_id
  
  local room_id = redis.call('get', user_to_room_key)
  if not room_id then
    return nil
  end

  local room_data = redis.call('get', room_id)
  if not room_data then
    -- The user mapping is stale, so we'll clean it up.
    redis.call('del', user_to_room_key)
    return nil
  end

  return {room_id, room_data}
`;

// Lua script: Atomically remove a socket from a user's socket set.
// If the set becomes empty, the set key is deleted.
// KEYS[1]: userSockets set key (e.g., userSockets:some-user-id)
// ARGV[1]: socket.id
export const CLEANUP_USER_LUA = `
  local user_sockets_key = KEYS[1]
  local socket_id = ARGV[1]

  redis.call('srem', user_sockets_key, socket_id)
  
  if redis.call('scard', user_sockets_key) == 0 then
    redis.call('del', user_sockets_key)
  end
`;
