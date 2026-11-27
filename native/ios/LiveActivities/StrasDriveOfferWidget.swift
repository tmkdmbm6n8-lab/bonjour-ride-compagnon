import ActivityKit
import SwiftUI
import WidgetKit

// Replace the existing GenericAttributes widget implementation with this file in Xcode.
// Keep its existing GenericAttributes definition, shared with capacitor-live-activity.
// Do not add this alongside a second ActivityConfiguration for GenericAttributes.
@available(iOS 16.2, *)
struct StrasDriveOfferWidget: Widget {
    private func amount(_ context: ActivityViewContext<GenericAttributes>) -> String {
        context.state.values["earnings"] ?? context.state.values["title"] ?? "Nouvelle course"
    }

    private func deadline(_ context: ActivityViewContext<GenericAttributes>) -> Date {
        Date(timeIntervalSince1970: Double(context.state.values["expiresAt"] ?? "0") ?? 0)
    }

    var body: some WidgetConfiguration {
        ActivityConfiguration(for: GenericAttributes.self) { context in
            HStack(spacing: 16) {
                Image(systemName: "car.fill")
                VStack(alignment: .leading, spacing: 4) {
                    Text("StrasDrive").font(.headline)
                    Text(context.state.values["status"] ?? "Nouvelle course")
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 4) {
                    Text(amount(context)).font(.headline)
                    Text(timerInterval: Date.now...max(Date.now, deadline(context)), countsDown: true)
                        .monospacedDigit().font(.caption)
                }
            }
            .padding()
            .widgetURL(URL(string: "https://strasdrive.fr/driver/dashboard?offer=\(context.attributes.id)"))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: "car.fill")
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(amount(context)).font(.headline)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        Text(context.state.values["status"] ?? "Nouvelle course")
                        Spacer()
                        Text(timerInterval: Date.now...max(Date.now, deadline(context)), countsDown: true)
                            .monospacedDigit().frame(maxWidth: 64)
                    }
                }
            } compactLeading: {
                Image(systemName: "car.fill")
            } compactTrailing: {
                Text(amount(context)).font(.caption).minimumScaleFactor(0.7)
            } minimal: {
                Image(systemName: "car.fill")
            }
            .widgetURL(URL(string: "https://strasdrive.fr/driver/dashboard?offer=\(context.attributes.id)"))
        }
    }
}