import * as assert from 'assert';
import * as path from 'path';
import { TextDocument } from 'vscode-languageclient/lib/main';
import { Uri, commands, window, workspace } from 'vscode';
import { GaugeVSCodeCommands, REPORT_URI } from '../../src/constants';

let testDataPath = path.join(__dirname, '..', '..', '..', 'test', 'testdata', 'sampleProject');

suite('Gauge Execution Tests', () => {
    setup(async () => { await commands.executeCommand('workbench.action.closeAllEditors'); });

    teardown(async () => {
        await commands.executeCommand(GaugeVSCodeCommands.StopExecution);
    });

    test('should execute given specification', (done) => {
        let spec = path.join(testDataPath, 'specs', 'example.spec');
        window.showTextDocument(Uri.file(spec)).then(() => {
            commands.executeCommand(GaugeVSCodeCommands.Execute, spec).then((result: any) => {
                assert.ok(result.status, result.rawout);
            }, (e) => done(e));
        }, (e) => done(e));
    }).timeout(10000);

    test('should execute given scenario', (done) => {
        let spec = Uri.file(path.join(testDataPath, 'specs', 'example.spec'));
        window.showTextDocument(spec).then(() => {
            let scenario = spec.path + ":6";
            commands.executeCommand(GaugeVSCodeCommands.Execute, scenario).then(() => {
                commands.executeCommand(GaugeVSCodeCommands.Execute, spec).then((result: any) => {
                    assert.ok(result.status, result.rawout);
                }, (e) => done(e));
            }, (e) => done(e));
        }, (e) => done(e));
    }).timeout(10000);

    test('should execute all specification in spec dir', (done) => {
        commands.executeCommand(GaugeVSCodeCommands.ExecuteAllSpecs).then((result: any) => {
            assert.ok(result.status, result.rawout);
        }, (e) => done(e));
    }).timeout(10000);

    test('should execute currently open specification', (done) => {
        let specFile = Uri.file(path.join(testDataPath, 'specs', 'example.spec'));
        window.showTextDocument(specFile).then(() => {
            commands.executeCommand(GaugeVSCodeCommands.ExecuteSpec).then((result: any) => {
                assert.ok(result.status, result.rawout);
            }, (e) => done(e));
        });
    }).timeout(10000);

    test('should execute scenario at cursor', async () => {
        let specFile = Uri.file(path.join(testDataPath, 'specs', 'example.spec'));
        let editor = await window.showTextDocument(specFile);
        await commands.executeCommand("workbench.action.focusFirstEditorGroup");
        let cm = { to: 'down', by: 'line', value: 8 };
        await commands.executeCommand("cursorMove", cm);
        return commands.executeCommand(GaugeVSCodeCommands.ExecuteScenario);
    }).timeout(10000);

    test('should abort execution', async () => {
        let spec = path.join(testDataPath, 'specs', 'example.spec');
        await window.showTextDocument(Uri.file(spec));
        // simulate a delay, we could handle this in executor, i.e. before spawining an execution
        // check if an abort signal has been sent.
        // It seems like over-complicating things for a non-human scenario :)
        setTimeout(() => commands.executeCommand(GaugeVSCodeCommands.StopExecution), 100);
        let result: any = await commands.executeCommand(GaugeVSCodeCommands.Execute, spec);
        assert.equal(result.status, false, result.rawout);
    });

    test('should open reports inline after execution', async () => {
        let result: any = await commands.executeCommand(GaugeVSCodeCommands.ExecuteAllSpecs);
        assert.ok(result.status, result.rawout);
        await commands.executeCommand(GaugeVSCodeCommands.ShowReport);
        assert.ok(workspace.textDocuments.some((d) =>
            !d.isClosed && d.uri.toString() === REPORT_URI),
            "Expected one document to have last run report");
    });

    test('should reject execution when another is already in progress', async () => {
        let spec = path.join(testDataPath, 'specs', 'example.spec');
        await window.showTextDocument(Uri.file(spec));
        commands.executeCommand(GaugeVSCodeCommands.ExecuteAllSpecs);
        try {
            await commands.executeCommand(GaugeVSCodeCommands.Execute, spec);
            throw new Error("Expected simultaneous runs to reject");
        } catch (err) {
            assert.equal(err.message, "A Specification or Scenario is still running!");
        }
    }).timeout(10000);
});