import ctypes, os
from pathlib import Path
binary = Path('C:/Program Files/obs-studio/bin/64bit')
dll_directory = os.add_dll_directory(str(binary))
ctypes.windll.kernel32.SetDllDirectoryW(str(binary))
lua = ctypes.CDLL(str(binary/'lua51.dll'))
lua.luaL_newstate.restype=ctypes.c_void_p
lua.luaL_openlibs.argtypes=[ctypes.c_void_p]
lua.luaL_loadstring.argtypes=[ctypes.c_void_p,ctypes.c_char_p]
lua.lua_pcall.argtypes=[ctypes.c_void_p,ctypes.c_int,ctypes.c_int,ctypes.c_int]
lua.lua_tolstring.argtypes=[ctypes.c_void_p,ctypes.c_int,ctypes.c_void_p];lua.lua_tolstring.restype=ctypes.c_char_p
lua.lua_close.argtypes=[ctypes.c_void_p]
native_obs = ctypes.CDLL(str(binary/'obs.dll'))
assert native_obs.os_process_pipe_create and native_obs.os_process_pipe_destroy
state=lua.luaL_newstate();lua.luaL_openlibs(state)
source="""
package.cpath = 'C:/Program Files/obs-studio/data/obs-scripting/64bit/?.dll;' .. package.cpath
local real = require('obslua')
for _,name in ipairs({'obs_frontend_get_profile_config','obs_frontend_streaming_active','obs_frontend_get_streaming_output','obs_video_info','obs_get_video_info','obs_output_get_total_frames','obs_output_set_mixers','obs_output_set_media','config_get_uint','obs_data_save_json_safe'}) do
 assert((type(real[name]) == 'function' or (name == 'obs_video_info' and type(real[name]) == 'table')), 'Missing installed OBS binding: ' .. name)
end
local streaming = false
local created, stopped, launched = 0, 0, 0
local profile = 'OBS Service Scene'
local last
obslua = {
 obs_frontend_get_current_profile=function() return profile end,
 obs_frontend_streaming_active=function() return streaming end,
 obs_data_create_from_json_file=function() return {nodePath='C:/node.exe',profileName='OBS Service Scene'} end,
 obs_data_create=function() return {} end,
 obs_data_get_string=function(d,k) return d[k] or '' end,
 obs_data_set_string=function(d,k,v) d[k]=v end,
 obs_data_set_bool=function(d,k,v) d[k]=v end,
 obs_data_set_int=function(d,k,v) d[k]=v end,
 obs_data_save_json_safe=function(d) last=d end,
 obs_data_release=function() end,
 os_process_pipe_create=function() launched=launched+1; return {} end,
 os_process_pipe_destroy=function() end,
 timer_add=function(fn) timer=fn end, timer_remove=function() end,
 obs_output_create=function(kind,name,settings) assert(kind=='ffmpeg_output');assert(settings.format_name=='adts');assert(settings.audio_bitrate==128);created=created+1;return {} end,
 obs_output_set_media=function() end, obs_get_video=function() end,obs_get_audio=function() end,
 obs_frontend_get_profile_config=function() return {} end, config_get_uint=function() return 1 end,
 obs_output_set_mixers=function(o,m) assert(m==1) end,
 obs_output_start=function(o) o.active=true;return true end,
 obs_output_active=function(o) return o.active end,
 obs_output_stop=function() stopped=stopped+1 end,obs_output_release=function() end
}
function script_path() return 'tools/live-audio/automatic/' end
dofile('tools/live-audio/automatic/lightcity-auto.lua')
script_load({}); assert(created==0 and launched==1)
streaming=true;timer();assert(created==1 and last.streaming and last.streamSession:match('^stream%-'))
timer();assert(created==1)
streaming=false;timer();assert(stopped==1 and not last.streaming)
profile='LightCity Audio Test';streaming=true;timer();assert(created==1 and not last.streaming)
script_unload()
"""
try:
 rc=lua.luaL_loadstring(state,source.encode())
 if not rc: rc=lua.lua_pcall(state,0,0,0)
 if rc: raise RuntimeError(lua.lua_tolstring(state,-1,None).decode())
 print('PASS: installed OBS bindings and Lua start/stop/profile isolation lifecycle.')
finally: lua.lua_close(state)
