require 'optparse'
require 'fileutils'

WINDOWS = RUBY_PLATFORM.match(/cygwin|mswin|mingw|bccwin|wince|emx/)
TMP_FOLDER = "thrift-temp"
THRIFT_EXE_NAME_WIN = "thrift.exe"
THRIFT_EXE_NAME_LINUX = "thrift"
DEFINITIONS_FILENAME = "com.iar.services.ide-9.0.4-SNAPSHOT-thrift.zip"
DEFINITIONS_URL = "http://seupp-s-ci02.ad.iar.com:8080/job/thrift-services/job/thrift-services-ide-trunk/lastSuccessfulBuild/artifact/Services/ThriftServiceDefinitions/com.iar.services.ide/target/" + DEFINITIONS_FILENAME

def error(str)
  STDERR.puts "ERROR: " + str
  exit(1)
end

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

#----------------------------------------------------------------------

def get_thrift_compiler
  path = $options[:thrift]
  return path if path

  name = WINDOWS ? THRIFT_EXE_NAME_WIN : THRIFT_EXE_NAME_LINUX
  path = File.join(__dir__, name)
  return path if File.file?(path)

  thrift_for_ts = File.expand_path("../../thrift-for-ts", __dir__)
  path = File.join(thrift_for_ts, name)
  return path if File.file?(path)

  thrift_dir = ENV["PATH"].split(File::PATH_SEPARATOR).find do |d|
    File.exist?(File.join(d, name))
  end
  path = thrift_dir ? File.join(thrift_dir, name) : nil
  return path if File.file?(path)

  raise "Couldn't find a thrift compiler to use. Please make sure #{name} is in your PATH or adjacent to this script. You may also manually point it out (see --help)."
end

#----------------------------------------------------------------------

# resolve path to extension
case ARGV.size
when 0
  iar_vsc_path = Dir.pwd
when 1
  iar_vsc_path = File.expand_path(ARGV[0])
else
  raise "too many arguments ...."
end

if !valid_iar_vsc_path?(iar_vsc_path)
  error("folder does not contain the 'iar-vsc' sources (no 'package.json'): #{iar_vsc_path}")
end

thrift_compiler_path = get_thrift_compiler()
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
