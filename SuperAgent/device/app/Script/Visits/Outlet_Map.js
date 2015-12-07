function OnLoad() {
	if ($.Exists("map"))
		$.map.AddMarker("", $.workflow.outlet.Lattitude, $.workflow.outlet.Longitude, "blue");
}
