//-------------Side menu---------------

function GetItemsStyles(){
	var styles = new Dictionary();
	styles.Add("Summary", IsCurrent("Summary"));
	styles.Add("Visits", IsCurrent("Visits"));
	styles.Add("Outlets", IsCurrent("Outlets"));
	styles.Add("Orders", IsCurrent("Orders"));
	styles.Add("Returns", IsCurrent("Returns"));
	styles.Add("Sync", IsCurrent("Sync"));
	styles.Add("About", IsCurrent("About"));

	return styles;
}

function ShowDialog(val){
	Dialog.Debug(val);
}

function IsCurrent(name){	
	var c = GlobalWorkflow.GetMenuItem() == null ? "Summary" : GlobalWorkflow.GetMenuItem();
	return name == c ? "header" : "common";
}

function OpenMenu(sl) {
	if (sl.Index == 1) {
		sl.Index = 0;
	} else if (sl.Index == 0) {
		sl.Index = 1;
	}
}

function GetPlannedVisits(){
	return Indicators.GetPlannedVisits();
}

function GetOutletsCount() {
	return Indicators.GetOutletsCount();
}

function GetCommitedScheduledVisits() {
	return Indicators.GetCommitedScheduledVisits().ToString();
}

function GetOrderSumm() {
	return FormatValue(Indicators.GetOrderSumm());
}

function GetOrderQty(){
	return Indicators.GetOrderQty();
}

function GetReturnQty(){
	return Indicators.GetReturnQty();
}

function GetReturnSum(){
	return Indicators.GetReturnSum();
}

function GetLastSyncTime() {
	if (DB.SuccessSync)
		return DB.LastSyncTime.ToString("dd.MM HH:mm");
	else
		return Translate["#error#"];
}

function GetMainVersion(ver) {
	if (ver==null)
		ver = "";
	return Left(ver, 3);
}

function LogoutQuery() {

	Dialog.Alert("#logoutQuery#"
		    , LogoutCallback
		    , null
		    , "#cancel#"
		    , "#logoutConfirm#"
		    , null);

}

function LogoutCallback(state, args) {

	if (args.Result == 1) {

		Application.Logout();

	}

}

function SwitchScreen(actionName){
	GlobalWorkflow.SetMenuItem(actionName);
	DoAction(actionName);
}