function OnLoad() {
	if ($.Exists("map"))
		$.map.AddMarker("", $.outlet.Lattitude, $.outlet.Longitude, "blue");
}
