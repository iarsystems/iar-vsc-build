#!/usr/bin/env python3
#----------------------------------------------------------------------
# generate_projects.py
#
# Generates all the EW projects used by the test suites from a template
# (i.e. from an empty project).
# This can generate test projects for a target, so that the test suites
# can be run for that target.
#----------------------------------------------------------------------

import argparse
import os
import xml.etree.ElementTree as ET
import shutil
import copy

def parse_arguments():
    parser = argparse.ArgumentParser('generate_projects.py')
    add = parser.add_argument
    add('--source-project', action='store',
        help='The base project to derive test projects from')
    add('--target-id', action='store',
        help='An ID for the target, e.g. "arm" or "riscv"')
    return parser.parse_args()

# --- Project manipulation utils

def add_file(root, path, config=None, tag=None):
    file = ET.SubElement(root, 'file')
    ET.SubElement(file, 'name').text = path
    if config is not None:
        for setting in config.findall("settings"):
            if not setting.find("./name").text.startswith("ICC"):
                config.remove(setting)
        file.append(config)
    if tag is not None:
        ET.SubElement(file, 'tag').text = tag
    return file

def add_group(root, name, files):
    group = ET.SubElement(root, 'group')
    ET.SubElement(group, 'name').text = name
    for file in files:
        add_file(group, file)

def add_include_paths(config, include_paths):
    includes = config.find(".//name[.='CCIncludePath2']/..")
    if includes is None:
        includes = config.find(".//name[.='newCCIncludePaths']/..")
    if includes is None:
        raise "Could not find includes element"
    for inc in include_paths:
        ET.SubElement(includes, "state").text = inc

# --- Project creation functions

def create_integration_test_project(source_file, target_id):
    """Creates the test project for the integrationTests suite"""

    integration_projects_dir = os.path.join(os.path.dirname(__file__), 'integrationTests/TestProjects/')
    target_dir = os.path.join(integration_projects_dir, target_id)
    os.makedirs(target_dir, exist_ok=True)
    shutil.copytree(os.path.join(integration_projects_dir, 'skeleton'), target_dir, dirs_exist_ok=True)
    target_file = os.path.join(target_dir, 'test_project.ewp')

    tree = ET.parse(source_file)
    root = tree.getroot()
    original_config = copy.deepcopy(root.find("./configuration/name[.='Debug']/.."))
    for file in root.findall('file'):
        root.remove(file)

    add_include_paths(root, ["$PROJ_DIR$/inc"])
    # try:
    #     root.find(".//name[.='CCIncludePath2']/../state").text = '$PROJ_DIR$/inc'
    # except:
    #     root.find(".//name[.='newCCIncludePaths']/../state").text = '$PROJ_DIR$/inc'
    ccdefines = root.find(".//name[.='CCDefines']/..")
    ET.SubElement(ccdefines, 'state').text = 'MY_SYMBOL=42'
    ET.SubElement(ccdefines, 'state').text = 'MY_SYMBOL2="test"'
    root.find(".//name[.='PreInclude']/../state").text = 'preincluded.h'

    add_file(root, '$PROJ_DIR$/util.c')

    override_config = copy.deepcopy(original_config)
    add_include_paths(override_config, ["$PROJ_DIR$/inc2"])
    defs = override_config.find(".//name[.='CCDefines']/..")
    ET.SubElement(defs, 'state').text = 'FILE_SYMBOL=42'
    add_file(root, '$PROJ_DIR$/main.c', override_config)

    cpp_config = copy.deepcopy(original_config)
    cpp_config.find(".//name[.='IccLang']/../state").text = "1"
    add_file(root, '$PROJ_DIR$/cpp.cpp', cpp_config)

    print(target_file)
    tree.write(target_file)

def create_vscode_test_projects(source_file, target_id):
    """Creates the test projects for the vscodeTests suite"""

    projects_dir = os.path.join(os.path.dirname(__file__), 'vscodeTests/TestProjects/')
    target_dir = os.path.join(projects_dir, target_id)
    os.makedirs(target_dir, exist_ok=True)
    shutil.copytree(os.path.join(projects_dir, 'skeleton'), target_dir, dirs_exist_ok=True)

    # C-STATProject project
    tree = ET.parse(source_file)
    target_file = os.path.join(target_dir, 'C-STATProject/C-STATProject.ewp')
    add_file(tree.getroot(), "$WS_DIR$/C-STATProject/main.c")
    tree.write(target_file)
    ewt_file = os.path.join(target_dir, 'C-STATProject/C-STATProject.ewt')
    ewt = ET.parse(ewt_file)
    for target in ewt.findall(".//toolchain/name[.='ARM']"):
        target.text = target_id.upper()
    if target_id == "riscv" or target_id == "rh850":
        # targets that do not have thrift PM support should use the default c-stat output directory, so the extension can find it
        ewt.find(".//outputDir").text = "Debug/C-STAT"
    ewt.write(ewt_file)

    # GettingStarted project
    tree = ET.parse(source_file)
    add_file(tree.getroot(), "$PROJ_DIR$/Fibonacci.c")
    add_file(tree.getroot(), "$PROJ_DIR$/Utilities.c")
    target_file = os.path.join(target_dir, 'GettingStarted/BasicDebugging.ewp')
    tree.write(target_file)

    # ArgVars project
    tree = ET.parse(source_file)
    for file in tree.getroot().findall('file'):
        tree.getroot().remove(file)
    add_file(tree.getroot(), "$PROJ_DIR$/$TEST$.c")
    add_file(tree.getroot(), "$WS_DIR$/ArgVars/Utilities.c")
    target_file = os.path.join(target_dir, 'ArgVars/ArgVars.ewp')
    #   change output binary name
    try:
        tree.find(".//name[.='IlinkOutputFile']/../state").text = "ArgVars.out"
    except:
        tree.find(".//name[.='XLINK']/../data/option/name[.='OutputFile']/../state").text = "ArgVars.out"
    tree.write(target_file)

    # SourceConfiguration project
    tree = ET.parse(source_file)
    root = tree.getroot()
    root.remove(root.find("./configuration/name[.='Release']/.."))
    config = root.find("./configuration/name[.='Debug']/..")
    config.find("name").text = 'TheConfiguration'
    add_include_paths(config, ["$WS_DIR$/SourceConfiguration/Project", "$PROJ_DIR$/../Library/inc"])
    add_file(root, '$PROJ_DIR$/main.c')
    add_file(root, '$PROJ_DIR$\\readme.txt')
    add_group(root, 'lib',
      ['$PROJ_DIR$\..\Library/src/gpio.c'])
    if target_id == "arm":
        config.find(".//name[.='OGUseCmsis']/../state").text = "1"
        config.find(".//name[.='OGUseCmsisDspLib']/../state").text = "1"
    target_file = os.path.join(target_dir, 'SourceConfiguration/Project/SourceConfigurationNoDefines.ewp')
    tree.write(target_file)

    defines = config.find(".//name[.='CCDefines']/..")
    ET.SubElement(defines, 'state').text = 'USE_STDPERIPH_DRIVER=1'
    ET.SubElement(defines, 'state').text = 'HSE_VALUE=8000000'
    target_file = os.path.join(target_dir, 'SourceConfiguration/Project/SourceConfiguration.ewp')
    tree.write(target_file)

    # CMakeProject
    tree = ET.parse(source_file)
    root = tree.getroot()
    for conf in root.findall("./configuration"):
        root.remove(conf)
    config = ET.SubElement(root, "configuration")
    ET.SubElement(config, "name").text = "IWillBeRemoved"
    ET.SubElement(config, "debug").text = "1"
    toolchain = ET.SubElement(config, "toolchain")
    ET.SubElement(toolchain, "name").text = "CMake_" + target_id.upper()
    add_file(root, "$PROJ_DIR$/CMakeLists.txt", tag = "IAR.ControlFile")
    target_file = os.path.join(target_dir, "CMakeProject/CMakeProject.ewp")
    ET.indent(tree)
    tree.write(target_file)


def main(opts):
    create_integration_test_project(opts.source_project, opts.target_id)
    create_vscode_test_projects(opts.source_project, opts.target_id)


if __name__ == '__main__':
    exit(main(parse_arguments()))