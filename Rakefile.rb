
task "default" => "build-vsix"

desc "build .vsix file"
task "build-vsix" do
    sh "ruby Extension/build.rb Extension"
end

desc "remove all non-versioned files"
task "distclean" do
    sh "git clean --force -d -x"
end
