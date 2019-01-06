
import * as Vscode from "vscode";
import * as Path from "path";

import { Settings } from "../settings";


interface IarTaskDefinition extends Vscode.TaskDefinition {
    readonly command: string;
    readonly project: string;
    readonly config: string;
    readonly label?: string;
}

export namespace IarTaskProvider {
    let tasks: Vscode.Task[] = [];
    let taskProvider: Vscode.Disposable | undefined = undefined;

    export function register(): void {
        if (!taskProvider) {
            taskProvider = Vscode.tasks.registerTaskProvider("iar", {
                provideTasks: () => {
                    if (tasks.length === 0) {
                        tasks = getTasks();
                    }

                    return tasks;
                },
                resolveTask: (task: Vscode.Task) => {
                    return resolve(task);
                }
            });
        }
    }

    export function unregister(): void {
        if (taskProvider) {
            taskProvider.dispose();
            taskProvider = undefined;
        }
    }

    function getTasks(): Vscode.Task[] {
        let tasks: Vscode.Task[] = [];

        let ewpLocation = "${config:iarvsc.ewp}";
        let config = "${config:iarvsc.configuration}";

        let task: Vscode.Task | undefined;
        let definition: IarTaskDefinition;
        let label: string;
        let name: string;

        definition = generateDefinition("build", ewpLocation, config);
        label = definition.label as string; /* we generated it, so the label exists */
        name = label + " - template using selected workbench, project and config";
        task = generateTask(name, definition);
        if (task) {
            setProblemMatchers(task);
            tasks.push(task);
        }

        definition = generateDefinition("rebuild", ewpLocation, config);
        label = definition.label as string; /* we generated it, so the label exists */
        name = label + " - template using selected workbench, project and config";
        task = generateTask(name, definition);
        if (task) {
            setProblemMatchers(task);
            tasks.push(task);
        }

        return tasks;
    }

    function setProblemMatchers(task: Vscode.Task): void {
        task.problemMatchers.push("$iar-cc");
        task.problemMatchers.push("$iar-linker");
    }

    function generateTask(name: string, definition: IarTaskDefinition): Vscode.Task | undefined {
        let compilerCommand: string | undefined = getCompilerCommand(definition.command);

        if (compilerCommand) {
            let task = new Vscode.Task(definition,
                name,
                "iar",
                generateExecution("${config:iarvsc.workbench}\\common\\bin\\IarBuild.exe",
                    definition.project, compilerCommand, definition.config)
            );

            return task;
        } else {
            return undefined;
        }
    }

    function generateDefinition(command: string, project: string, config: string): IarTaskDefinition {
        let label = "IAR " + command.charAt(0).toUpperCase() + command.slice(1);

        return {
            label: label,
            type: "iar",
            command: command,
            project: project,
            config: config
        };
    }

    function generateExecution(compilerPath: string, project: string, compilerCommand: string, config: string) {
        return new Vscode.ProcessExecution(compilerPath, [project, compilerCommand, config]);
    }

    function resolve(task: Vscode.Task): Vscode.Task | undefined {
        let definition = task.definition;

        if (isIarTaskDefinition(definition)) {
            let compilerPath = "${config:iarvsc.workbench}\\common\\bin\\IarBuild.exe";
            task.execution = generateExecution(compilerPath, definition.project, definition.command, definition.config);
            return task;
        } else {
            return undefined;
        }
    }

    function getCompilerCommand(command: string): string | undefined {
        switch (command) {
            case "build":
                return "-make";
            case "rebuild":
                return "-build";
            default:
                return undefined;
        }
    }

    function isIarTaskDefinition(definition: Vscode.TaskDefinition | IarTaskDefinition): definition is IarTaskDefinition {
        let isIarTaskDefinition: boolean = true;
        let iarTaskDefinition = definition as IarTaskDefinition;

        if (isIarTaskDefinition) {
            isIarTaskDefinition = (iarTaskDefinition.command !== undefined)
                && (getCompilerCommand(iarTaskDefinition.command) !== undefined);
        }

        if (isIarTaskDefinition) {
            isIarTaskDefinition = iarTaskDefinition.config !== undefined;
        }

        if (isIarTaskDefinition) {
            isIarTaskDefinition = iarTaskDefinition.project !== undefined;
        }


        if (isIarTaskDefinition) {
            isIarTaskDefinition = (iarTaskDefinition.type !== undefined)
                && (iarTaskDefinition.type === "iar");
        }

        return isIarTaskDefinition;
    }
}
