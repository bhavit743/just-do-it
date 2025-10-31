import Foundation
import Capacitor

@objc(AppGroupReader)
public class AppGroupReader: CAPPlugin {
  private let groupId = "group.com.personaldash.app" // ← your App Group (must match entitlements)

  // Helps confirm plugin actually loaded (check Xcode console)
  public override func load() {
    NSLog("[AppGroupReader.swift] plugin loaded")
  }

  private func sharedDir() throws -> URL {
    guard let url = FileManager.default
      .containerURL(forSecurityApplicationGroupIdentifier: groupId)?
      .appendingPathComponent("Shared", isDirectory: true)
    else {
      throw NSError(domain: "AppGroupReader", code: 1,
                    userInfo: [NSLocalizedDescriptionKey: "App Group not available"])
    }
    try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
    return url
  }

  // list() -> { files: string[] }
  @objc func list(_ call: CAPPluginCall) {
    do {
      let dir = try sharedDir()
      let names = try FileManager.default.contentsOfDirectory(atPath: dir.path)
      call.resolve(["files": names])
    } catch {
      call.reject(error.localizedDescription)
    }
  }

  // read({ name }) -> { data: base64, name }
  @objc func read(_ call: CAPPluginCall) {
    guard let name = call.getString("name"), !name.isEmpty else {
      call.reject("name required"); return
    }
    do {
      let dir = try sharedDir()
      let url = dir.appendingPathComponent(name)
      let data = try Data(contentsOf: url)
      call.resolve(["data": data.base64EncodedString(), "name": name])
    } catch {
      call.reject(error.localizedDescription)
    }
  }

  // remove({ name }) -> void
  @objc func remove(_ call: CAPPluginCall) {
    guard let name = call.getString("name"), !name.isEmpty else {
      call.reject("name required"); return
    }
    do {
      let dir = try sharedDir()
      let url = dir.appendingPathComponent(name)
      if FileManager.default.fileExists(atPath: url.path) {
        try FileManager.default.removeItem(at: url)
      }
      call.resolve()
    } catch {
      call.reject(error.localizedDescription)
    }
  }
}
