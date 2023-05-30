@Library('common@tags/1.9.1') _

node('a_windows || a_linux') {
	stage('Load pipeline') {
		deleteDir()
		dir('release-scripts') {
			git credentialsId: 'gitsshkey', url: 'ssh://git@gitlab.iar.se:2222/ide/vscode/releng/release-scripts.git', branch: "master"
			runner = load "release/iar-vsc-build.groovy"
		}
	}
}

runner.build_and_test("$BRANCH_NAME")
