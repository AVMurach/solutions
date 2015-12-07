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

function Logout() {

	var q = new Query("SELECT name " +
		"FROM SQLITE_MASTER " +
		"WHERE type='view' " +
		"AND (Contains(name, 'Document') OR Contains(name, 'Catalog'))");
		var tables = q.Execute();

		var queryString = "";
		while (tables.Next()){
			queryString = queryString +
			" SELECT DISTINCT IsDirty " +
			" FROM " + tables.name + " WHERE IsDirty=1 " +
			" UNION ALL "
		}
		queryString = queryString + " SELECT DISTINCT IsDirty FROM Catalog_Distributor ";

		var q2 = new Query();
		q2.Text = queryString;

		var ex = q2.ExecuteScalar();
		var res = String.IsNullOrEmpty(ex) ? 0 : ex;

		if (parseInt(res) == parseInt(1))
			Dialog.Message("#noLogout#", GoToSync);
		else{
			Dialog.Alert("#logoutQuery#"
		    , LogoutCallback
		    , null
		    , "#cancel#"
		    , "#logoutConfirm#"
		    , null);
		}

}

function GoToSync(){
	Workflow.Action('Sync', []);
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