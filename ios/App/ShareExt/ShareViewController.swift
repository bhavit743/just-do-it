import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {

  // Make optional so we don’t crash if the outlet isn’t wired
  @IBOutlet weak var statusLabel: UILabel?

  private let groupId = "group.com.personaldash.app"
  private var containerURL: URL!

  // Create a label if the storyboard outlet isn’t connected
  private func ensureStatusLabel() {
    guard statusLabel == nil else { return }
    let lbl = UILabel()
    lbl.translatesAutoresizingMaskIntoConstraints = false
    lbl.textAlignment = .center
    lbl.numberOfLines = 0
    lbl.font = .systemFont(ofSize: 17, weight: .medium)
    lbl.textColor = .label
    view.addSubview(lbl)
    NSLayoutConstraint.activate([
      lbl.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      lbl.centerYAnchor.constraint(equalTo: view.centerYAnchor),
      lbl.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 24),
      lbl.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -24),
    ])
    self.statusLabel = lbl
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    ensureStatusLabel()
    statusLabel?.text = "Preparing…"
  }

  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    ensureStatusLabel()

    guard let root = FileManager.default
      .containerURL(forSecurityApplicationGroupIdentifier: groupId)?
      .appendingPathComponent("Shared", isDirectory: true) else {
        statusLabel?.text = "App Group not available.\nCheck entitlements."
        NSLog("[ShareExt] AppGroup container URL nil for \(groupId)")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
          self.extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
        }
        return
    }

    containerURL = root
    try? FileManager.default.createDirectory(at: containerURL, withIntermediateDirectories: true)

    handleShare()
  }

  // MARK: - Main flow

  private func handleShare() {
    guard let items = extensionContext?.inputItems as? [NSExtensionItem] else {
      statusLabel?.text = "No items."
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.7) {
        self.extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
      }
      return
    }

    // Collect image-capable providers
    var providers: [NSItemProvider] = []
    for item in items {
      for p in item.attachments ?? [] {
        if let reg = p.registeredTypeIdentifiers as? [String] {
          NSLog("[ShareExt] Provider types: \(reg.joined(separator: ", "))")
        }
        if isImageProvider(p) { providers.append(p) }
      }
    }

    let total = providers.count
    if total == 0 {
      statusLabel?.text = "No images to import."
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.7) {
        self.extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
      }
      return
    }

    statusLabel?.text = "Saving \(total) image(s)…"
    let group = DispatchGroup()
    var savedNames: [String] = []
    var savedCount = 0

    for provider in providers {
      group.enter()

      // Unlabeled parameter
      func saveAndLeave(_ name: String) {
        savedNames.append(name)
        savedCount += 1
        DispatchQueue.main.async {
          self.statusLabel?.text = "Saved \(savedCount)/\(total)…"
        }
        group.leave()
      }

      func failAndLeave(_ error: Error?) {
        if let error { NSLog("[ShareExt] save failed: \(error.localizedDescription)") }
        group.leave()
      }

      // Best path: file representation (keeps original format)
      if #available(iOS 14.0, *),
         provider.hasItemConformingToTypeIdentifier(UTType.image.identifier) {

        provider.loadFileRepresentation(forTypeIdentifier: UTType.image.identifier) { tmpURL, _ in
          if let tmpURL {
            let ext = tmpURL.pathExtension.isEmpty ? "jpg" : tmpURL.pathExtension
            let name = UUID().uuidString + ".\(ext)"
            let dest = self.containerURL.appendingPathComponent(name)
            do {
              if FileManager.default.fileExists(atPath: dest.path) { try? FileManager.default.removeItem(at: dest) }
              try FileManager.default.copyItem(at: tmpURL, to: dest)
              saveAndLeave(name)
            } catch {
              // fallback to object/data
              self.loadAsImageOrData(provider: provider, saveAndLeave: saveAndLeave, failAndLeave: failAndLeave)
            }
          } else {
            self.loadAsImageOrData(provider: provider, saveAndLeave: saveAndLeave, failAndLeave: failAndLeave)
          }
        }

      } else {
        // Legacy path (no UTType.image)
        self.loadAsImageOrData(provider: provider, saveAndLeave: saveAndLeave, failAndLeave: failAndLeave)
      }
    }

    group.notify(queue: .main) {
      if !savedNames.isEmpty {
        // Optional queue via shared defaults if you want the app to poll a filename list
        let defaults = UserDefaults(suiteName: self.groupId)
        var queue = defaults?.stringArray(forKey: "incoming_files") ?? []
        queue.append(contentsOf: savedNames)
        defaults?.set(queue, forKey: "incoming_files")

        self.statusLabel?.text = "Saved \(savedNames.count) ✓"
      } else {
        self.statusLabel?.text = "Nothing saved."
      }
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.7) {
        self.extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
      }
    }
  }

  // MARK: - Helpers

  private func isImageProvider(_ p: NSItemProvider) -> Bool {
    if #available(iOS 14.0, *), p.hasItemConformingToTypeIdentifier(UTType.image.identifier) {
      return true
    }
    return p.hasItemConformingToTypeIdentifier("public.image") ||
           p.hasItemConformingToTypeIdentifier("public.jpeg") ||
           p.hasItemConformingToTypeIdentifier("public.png")
  }

  private func loadAsImageOrData(provider: NSItemProvider,
                                 saveAndLeave: @escaping (String) -> Void,
                                 failAndLeave: @escaping (Error?) -> Void) {
    // Try UIImage first
    if provider.canLoadObject(ofClass: UIImage.self) {
      provider.loadObject(ofClass: UIImage.self) { object, _ in
        if let img = object as? UIImage, let data = img.jpegData(compressionQuality: 0.95) {
          let name = UUID().uuidString + ".jpg"
          let dest = self.containerURL.appendingPathComponent(name)
          do { try data.write(to: dest); saveAndLeave(name) } catch { failAndLeave(error) }
        } else {
          self.loadRawData(provider: provider, saveAndLeave: saveAndLeave, failAndLeave: failAndLeave)
        }
      }
    } else {
      self.loadRawData(provider: provider, saveAndLeave: saveAndLeave, failAndLeave: failAndLeave)
    }
  }

  private func loadRawData(provider: NSItemProvider,
                           saveAndLeave: @escaping (String) -> Void,
                           failAndLeave: @escaping (Error?) -> Void) {
    if #available(iOS 14.0, *) {
      let ids = [UTType.jpeg.identifier, UTType.png.identifier]
      if let id = ids.first(where: { provider.hasItemConformingToTypeIdentifier($0) }) {
        provider.loadDataRepresentation(forTypeIdentifier: id) { data, e in
          if let data {
            let ext = id.contains("png") ? "png" : "jpg"
            let name = UUID().uuidString + ".\(ext)"
            let dest = self.containerURL.appendingPathComponent(name)
            do { try data.write(to: dest); saveAndLeave(name) } catch { failAndLeave(error) }
          } else { failAndLeave(e) }
        }
        return
      }
    }
    // Legacy identifiers
    let legacy = ["public.jpeg", "public.png"]
    if let id = legacy.first(where: { provider.hasItemConformingToTypeIdentifier($0) }) {
      provider.loadDataRepresentation(forTypeIdentifier: id) { data, e in
        if let data {
          let ext = id.contains("png") ? "png" : "jpg"
          let name = UUID().uuidString + ".\(ext)"
          let dest = self.containerURL.appendingPathComponent(name)
          do { try data.write(to: dest); saveAndLeave(name) } catch { failAndLeave(error) }
        } else { failAndLeave(e) }
      }
    } else {
      failAndLeave(nil)
    }
  }
}

