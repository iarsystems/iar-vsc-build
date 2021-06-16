
task "default" => "build-vsix"

desc "build .vsix file"
task "build-vsix" do
    sh "ruby Extension/build.rb Extension"
end

desc "remove all non-versioned files"
task "distclean" do
    sh "git clean --force -d -x"
end

desc "run tests"
task "run-tests" do
	sh "node Extension/out/test/runTests.js"
end

desc "run tests and produce junit"
task "run-tests-junit" do
	sh "node Extension/out/test/runTests.js --junit"
end
