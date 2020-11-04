require 'optparse'
require 'fileutils'

TMP_FOLDER = "thrift-temp"
THRIFT_EXE_NAME_WIN = "thrift.exe"
THRIFT_EXE_NAME_LINUX = "thrift"
DEFINITIONS_URL = "http://seupp-s-ci02.ad.iar.com:8080/job/thrift-services/job/thrift-services-ide-trunk/lastSuccessfulBuild/artifact/Services/ThriftServiceDefinitions/com.iar.services.ide/target/com.iar.services.ide-9.0.3-SNAPSHOT-thrift.zip"
DEFINITIONS_FILENAME = "com.iar.services.ide-9.0.3-SNAPSHOT-thrift.zip"

$options = {}
OptionParser.new do |opts|
  opts.banner = "Usage: build.rb [iar-vsc-path] [options]\n"
  opts.banner.concat "iar-vsc-path should point to the 'Extension' folder of the iar-vsc project. "
  opts.banner.concat "You may also run this script in that folder directly."

  opts.on("-q", "--quiet", "Surpress output to stdout") do |q|
    $options[:quiet] = q
  end
  opts.on("-h", "--help", "Print this help") do
        puts opts
        exit
  end
  opts.on("-t", "--thrift-path THRIFT-PATH", "Specify the path to the thrift compiler to use") do |t|
    $options[:thrift] = t
  end
end.parse!

def do_puts(str)
  return if $options[:quiet]
  puts str
end

def valid_iar_vsc_path?(path)
  File.file? File.join(path, "package.json")
end

def valid_thrift_compiler?(path)
  return false unless File.file? path
  version_string = `#{path} -version`
  version_string.match(/^Thrift version [0-9\.]+$/)
end

# resolve path to extension
iar_vsc_path = ARGV.shift
iar_vsc_path = Dir.pwd unless iar_vsc_path
raise "This folder does not seem to contain the 'iar-vsc' sources (see --help)." unless valid_iar_vsc_path?(iar_vsc_path)

# resolve path to thrift compiler
thrift_compiler_path = $options[:thrift]
unless thrift_compiler_path
  thrift_name = RUBY_PLATFORM.match(/cygwin|mswin|mingw|bccwin|wince|emx/) ? THRIFT_EXE_NAME_WIN : THRIFT_EXE_NAME_LINUX
  thrift_compiler_path = File.join(__dir__, thrift_name)
  unless File.file? thrift_compiler_path
    thrift_compiler_path = File.expand_path(File.join("../../thrift-for-ts", thrift_name))
    unless File.file? thrift_compiler_path
      thrift_dir = ENV["PATH"].split(File::PATH_SEPARATOR).find do |d|
        File.exist?(File.join(d, thrift_name))
      end
      thrift_compiler_path = thrift_dir ? File.join(thrift_dir, thrift_name) : nil
      raise "Couldn't find a thrift compiler to use. Please make sure #{thrift_name} is in your PATH or adjacent to this script. You may also manually point it out (see --help)." unless File.file?(thrift_compiler_path) 
    end
  end
end
do_puts "Found thrift compiler: #{thrift_compiler_path}"
raise "The thrift compiler does not seem to be valid." unless valid_thrift_compiler?(thrift_compiler_path)


tmp_folder = File.join(iar_vsc_path, TMP_FOLDER)

begin
  FileUtils.rm_rf(tmp_folder) if File.exist?(tmp_folder)
  FileUtils.mkdir_p(tmp_folder)
  Dir.chdir(tmp_folder)

  do_puts "Fetching Thrift definitions..."
  do_puts `wget #{$options[:quiet] ? "-q" : ""} #{DEFINITIONS_URL}`
  raise "The previous command was unsuccessful" unless $?.exitstatus == 0
  do_puts "Extracting and compiling Thrift definitions..."
  do_puts `unzip #{DEFINITIONS_FILENAME}`
  raise "The previous command was unsuccessful" unless $?.exitstatus == 0

  Dir.entries(Dir.pwd).select {|file| file.end_with?(".thrift")}.each do |file|
    command = "'#{thrift_compiler_path}' -gen js:ts,node -o #{Dir.pwd} #{File.join(Dir.pwd, file)}"
    do_puts command
    raise "Thrift definition failed to compile" unless system( command )
  end
  out_dir = File.join(Dir.pwd, "gen-nodejs")
  Dir.entries(out_dir).select {|file| not file.start_with?(".")}.each do |file|
    FileUtils.cp_r(File.join(out_dir, file), File.join(iar_vsc_path, "src/iar/project/thrift/bindings"))
  end

  Dir.chdir(iar_vsc_path)
  do_puts "Running 'npm install'..."
  do_puts `npm install`
  raise "The previous command was unsuccessful" unless $?.exitstatus == 0

  do_puts "Running TypeScript compiler..."
  do_puts `npm run compile`
  raise "The previous command was unsuccessful" unless $?.exitstatus == 0
rescue StandardError => e
  FileUtils.rm_rf(tmp_folder)
  raise e
else
  FileUtils.rm_rf(tmp_folder)
end

do_puts "Done building"
do_puts "Generating .vsix file..."

do_puts `npm install -g vsce`
raise "Failed to install vsce, which is needed to package the extension. Try running 'npm install -g vsce'." unless $?.exitstatus == 0

do_puts `vsce package`
raise "The previous command was unsuccessful" unless $?.exitstatus == 0

do_puts "Generating .vsix file..."