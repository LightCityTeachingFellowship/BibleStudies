# Windows cannot store characters such as ':' in filenames. Encode those
# characters only in generated paths; page.url and rendered links stay intact.
if Gem.win_platform?
  module LightCityWindowsOutput
    def destination(base_directory)
      output = super
      root = File.expand_path(base_directory).tr('\\', '/')
      full = File.expand_path(output).tr('\\', '/')
      prefix = root + '/'
      raise "Output escaped the build directory: #{output}" unless full.start_with?(prefix)
      relative = full.delete_prefix(prefix)
      encoded = relative.gsub(/[%<>:"\\|?*]/) { |char| '%%%02X' % char.ord }
      File.join(base_directory, encoded)
    end
  end

  Jekyll::Page.prepend(LightCityWindowsOutput)
  Jekyll::Document.prepend(LightCityWindowsOutput)
  Jekyll::StaticFile.prepend(LightCityWindowsOutput)
end
