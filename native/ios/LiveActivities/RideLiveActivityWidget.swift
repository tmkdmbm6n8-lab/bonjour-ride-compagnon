import ActivityKit
import SwiftUI
import WidgetKit

// Add this source to an iOS Widget extension once an iOS project exists.
@available(iOS 16.2, *)
struct RideLiveActivityWidget: Widget {
    private func duration(_ value: Int?) -> String {
        guard let value else { return "—" }
        return "\(value) min"
    }

    private func amount(_ cents: Int?) -> String {
        guard let cents else { return "—" }
        return (Double(cents) / 100).formatted(.currency(code: "EUR").locale(Locale(identifier: "fr_FR")))
    }

    private func title(_ state: RideActivityAttributes.ContentState) -> String {
        if state.kind == "driver_offer" { return "Nouvelle course" }
        if state.phase == "arrived" { return "Chauffeur arrivé" }
        if state.phase == "in_progress" { return "Vers votre destination" }
        return "Votre chauffeur arrive"
    }

    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RideActivityAttributes.self) { context in
            let state = context.state
            VStack(alignment: .leading, spacing: 8) {
                Text("STRASDRIVE").font(.caption2.bold()).foregroundStyle(.yellow)
                Text(title(state)).font(.headline)
                if state.kind == "driver_offer" {
                    HStack {
                        Label(duration(state.pickupMinutes), systemImage: "figure.walk")
                        Label(duration(state.tripMinutes), systemImage: "car.fill")
                        Spacer()
                        Text(amount(state.amountCents)).bold()
                    }.font(.subheadline)
                } else if state.phase != "arrived" {
                    Text("Temps estimé : \(duration(state.remainingMinutes))").font(.subheadline)
                }
            }
            .padding(16)
            .activityBackgroundTint(Color(red: 0.06, green: 0.07, blue: 0.1))
            .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            let state = context.state
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) { Text(title(state)).font(.caption.bold()) }
                DynamicIslandExpandedRegion(.trailing) {
                    if state.kind == "driver_offer" { Text(amount(state.amountCents)).bold() }
                    else if state.phase != "arrived" { Text(duration(state.remainingMinutes)).bold() }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    if state.kind == "driver_offer" {
                        HStack {
                            Text("Prise en charge : \(duration(state.pickupMinutes))")
                            Spacer()
                            Text("Trajet : \(duration(state.tripMinutes))")
                        }.font(.caption)
                    }
                }
            } compactLeading: {
                if state.kind == "driver_offer" {
                    Text(duration(state.pickupMinutes))
                        .font(.caption2.bold())
                        .foregroundStyle(.yellow)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                } else {
                    Image(systemName: "location.fill").foregroundStyle(.yellow)
                }
            } compactTrailing: {
                if state.kind == "driver_offer" { Text(amount(state.amountCents)).font(.caption2.bold()).lineLimit(1).minimumScaleFactor(0.7) }
                else if state.phase != "arrived" { Text(duration(state.remainingMinutes)).font(.caption2.bold()) }
                else { Image(systemName: "checkmark") }
            } minimal: {
                Image(systemName: "car.fill").foregroundStyle(.yellow)
            }.keylineTint(.yellow)
        }
    }
}
