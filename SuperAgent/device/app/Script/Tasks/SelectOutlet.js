
var title;
var back;

function OnLoading() {
	title = Translate["#selectOutlet#"];
	back = Translate["#back#"];
}

function OnLoad(){
	$.btnForward.Visible = false;
	$.titleForward.Visible = false;
}

function HasMenu(){

	return false;
}

function BackMenu(){
	return true;
}

function CreateOutletEnabled(){
	return false;
}

function AddGlobalAndAction(outlet){
	var task = GlobalWorkflow.GetCurrentTask();
	task = task.GetObject();
	task.Outlet = outlet;
	task.Save();
	DoBack();
}

function GetOutlets(searchText) {
	var search = "";
	var q = new Query();

	if (String.IsNullOrEmpty(searchText)==false) { //search processing
		searchText = StrReplace(searchText, "'", "''");
		search = "WHERE Contains(O.Description, '" + searchText + "') ";
	}

	q.Text = "SELECT O.Id, O.Description, O.Address, 'main_row' AS Style, 3 AS OutletStatus " +
		" FROM Catalog_Outlet O " +
		search + " ORDER BY O.Description LIMIT 500";

	return q.Execute();
}