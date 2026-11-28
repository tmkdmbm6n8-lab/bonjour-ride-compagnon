import ActivityKit
import SwiftUI
import WidgetKit

@available(iOS 16.2, *)
struct StrasDriveLiveActivityLiveActivity: Widget {
    private let gold = Color(red: 200 / 255.0, green: 168 / 255.0, blue: 88 / 255.0)
    private let darkBg = Color(red: 14 / 255.0, green: 15 / 255.0, blue: 18 / 255.0)

    var body: some WidgetConfiguration {
        ActivityConfiguration(for: GenericAttributes.self) { context in
            // Écran verrouillé
            HStack(spacing: 12) {
                Image(systemName: "location.fill")
                    .foregroundColor(gold)
                    .font(.system(size: 16, weight: .semibold))
                Text("StrasDrive")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundColor(.white)
                Spacer()
                Text("En ligne")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(gold)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(darkBg)
            .widgetURL(URL(string: "https://strasdrive.fr/driver/dashboard"))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 6) {
                        Image(systemName: "location.fill")
                            .foregroundColor(gold)
                            .font(.system(size: 14, weight: .semibold))
                        Text("StrasDrive")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(.white)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text("En ligne")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(gold)
                }
            } compactLeading: {
                Image(systemName: "location.fill")
                    .foregroundColor(gold)
                    .font(.system(size: 12, weight: .semibold))
            } compactTrailing: {
                EmptyView()
            } minimal: {
                Image(systemName: "location.fill")
                    .foregroundColor(gold)
                    .font(.system(size: 11, weight: .semibold))
            }
            .widgetURL(URL(string: "https://strasdrive.fr/driver/dashboard"))
        }
    }
}
