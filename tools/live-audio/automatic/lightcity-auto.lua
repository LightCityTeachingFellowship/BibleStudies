obs = obslua
-- OBS exposes process pipes through libobs, but not through every Lua binding.
local pipe_create, pipe_destroy = obs.os_process_pipe_create, obs.os_process_pipe_destroy
if not pipe_create then
    local ffi = require('ffi')
    ffi.cdef[[
        typedef struct os_process_pipe os_process_pipe_t;
        os_process_pipe_t *os_process_pipe_create(const char *cmd_line, const char *type);
        int os_process_pipe_destroy(os_process_pipe_t *pp);
    ]]
    local native = ffi.load('obs')
    pipe_create = function(command, mode)
        local pipe = native.os_process_pipe_create(command, mode)
        if pipe == ffi.NULL then return nil end
        return pipe
    end
    pipe_destroy = native.os_process_pipe_destroy
end
local base = script_path()
local work = base .. '../work/automatic/'
local output = nil
local config = nil
local session = ''
local started = 0
local last_launch = 0
local function millis() return os.time() * 1000 end
local function normal() return config and obs.obs_frontend_get_current_profile() == obs.obs_data_get_string(config, 'profileName') end
local function heartbeat(active)
    local data = obs.obs_data_create()
    obs.obs_data_set_int(data, 'version', 1)
    obs.obs_data_set_string(data, 'profile', obs.obs_frontend_get_current_profile())
    obs.obs_data_set_bool(data, 'streaming', active)
    obs.obs_data_set_string(data, 'streamSession', session)
    obs.obs_data_set_int(data, 'streamStartedAt', started)
    obs.obs_data_set_int(data, 'updatedAt', millis())
    obs.obs_data_save_json_safe(data, work .. 'control.json', 'tmp', 'bak')
    obs.obs_data_release(data)
end
local function stop_audio()
    if output then obs.obs_output_stop(output); obs.obs_output_release(output); output = nil end
end
local function launch()
    if not config or os.time() - last_launch < 20 then return end
    last_launch = os.time()
    local node = obs.obs_data_get_string(config, 'nodePath')
    if node == '' or node:find('["\r\n]') or base:find('["\r\n]') then return end
    local pipe = pipe_create('"' .. node .. '" "' .. base .. 'launcher.mjs"', 'r')
    if pipe then pipe_destroy(pipe) end
end
local function tick()
    local active = normal() and obs.obs_frontend_streaming_active()
    if active and session == '' then
        started = millis()
        if obs.obs_frontend_get_streaming_output and obs.obs_output_get_total_frames then
            local stream = obs.obs_frontend_get_streaming_output()
            if stream then
                local info = obs.obs_video_info()
                if obs.obs_get_video_info(info) and info.fps_num > 0 then
                    started = started - math.floor(obs.obs_output_get_total_frames(stream) * info.fps_den / info.fps_num * 1000)
                end
                obs.obs_output_release(stream)
            end
        end
        session = 'stream-' .. string.format('%.0f', started)
    end
    heartbeat(active)
    if not active then stop_audio(); session = ''; return end
    if output and not obs.obs_output_active(output) then stop_audio() end
    if not output then
        launch()
        local settings = obs.obs_data_create()
        obs.obs_data_set_string(settings, 'url', 'tcp://127.0.0.1:19354')
        obs.obs_data_set_string(settings, 'format_name', 'adts')
        obs.obs_data_set_string(settings, 'audio_encoder', 'aac')
        obs.obs_data_set_int(settings, 'audio_bitrate', 128)
        obs.obs_data_set_string(settings, 'muxer_settings', 'flush_packets=1')
        output = obs.obs_output_create('ffmpeg_output', 'LightCity automatic audio', settings, nil)
        obs.obs_data_release(settings)
        if output then
            obs.obs_output_set_media(output, obs.obs_get_video(), obs.obs_get_audio())
            local track = 1
            local profile = obs.obs_frontend_get_profile_config()
            if profile then track = tonumber(obs.config_get_uint(profile, 'AdvOut', 'TrackIndex')) or 1 end
            if track < 1 or track > 6 then track = 1 end
            obs.obs_output_set_mixers(output, 2 ^ (track - 1))
            if not obs.obs_output_start(output) then stop_audio() end
        end
    end
end
function script_description()
    return 'Starts separate 128 kbps audio alongside your normal YouTube stream. Uses the existing public and members video ID files. Complete setup.ps1 once before adding this script. Main streaming settings are unchanged.'
end
function script_load(settings)
    config = obs.obs_data_create_from_json_file(work .. 'obs.json')
    if not config then obs.script_log(obs.LOG_WARNING, 'Run the one-time LightCity audio setup first.'); return end
    launch()
    obs.timer_add(tick, 2000)
    tick()
end
function script_unload()
    obs.timer_remove(tick)
    heartbeat(false)
    stop_audio()
    if config then obs.obs_data_release(config); config = nil end
end
