//AVMurach+
function CreateOutlet() {
	if (Variables.Exists("setDistr")){
		if (Variables.Exists("outletFromDistr")){
			var outlet = $.outletFromDistr;
			outlet = outlet.GetObject();
			$.Remove("outletFromDistr");
		}else{
			var outlet = DB.Create("Catalog.Outlet");
			outlet.OutletStatus = DB.Current.Constant.OutletStatus.Potential;
			outlet.Save();
		}
		$.Remove("setDistr");
		
	}else{
		var outlet = DB.Create("Catalog.Outlet");
		outlet.OutletStatus = DB.Current.Constant.OutletStatus.Potential;
		outlet.Save();
	}	
	return outlet.Id;	
}

function GetTerritory() {
	var q = new Query("SELECT Id From Catalog_Territory LIMIT 1");
	var territory = q.ExecuteScalar();
	if (territory == null) {
		return  territoryEmptyRef;
	}
	else {
		return territory;
	}
	return territory || territoryEmptyRef;
}

function SaveAndDoAction(SelectDistr, outlet) {
			
	if (Variables.Exists("outletFromDistr"))
		$.Remove("outletFromDistr");
		$.AddGlobal("outletFromDistr", outlet);
		
	var parameters = [ outlet ];
	Workflow.Action(SelectDistr, parameters);
}
//AVMurach-

function DialogCallBack(control, key) {
	control.Text = key;
}

function DeleteAndBack(entity) {
	DB.Delete(entity);
	Workflow.Back();
}

function SaveNewOutlet(outlet) {

	outlet = outlet.GetObject();
	
	if (outlet.Description != null && outlet.Address != null){
		if (TrimAll(outlet.Description) != "" && TrimAll(outlet.Address) != "" && outlet.Class!=DB.EmptyRef("Catalog_OutletClass") 
				&& outlet.Type!=DB.EmptyRef("Catalog_OutletType") && $.territory!=null && outlet.Distributor!=DB.EmptyRef("Catalog_Distributor")) {
			var q = new Query("SELECT Ref FROM Catalog_Territory_SRs WHERE SR = @userRef LIMIT 1");+
			q.AddParameter("userRef", $.common.UserRef);
			var territory = q.ExecuteScalar();

			var to = DB.Create("Catalog.Territory_Outlets");
			to.Ref = $.territory;
			to.Outlet = outlet.Id;
			to.Save();

			outlet.Lattitude = parseInt(0);
			outlet.Longitude = parseInt(0);
			outlet.Save();
			Variables.AddGlobal("outlet", outlet.Id);

			DoAction("Open");
			
			return null;
		}
	}		
	Dialog.Message("#messageNulls#");
}

function DoSelectTerr(source, outlet, attribute, control, title) {
	if (control.Id != "outletTerritory") {
		DoChoose(null, outlet, attribute, control, CallBack, title);
	}
	else
	{
		if ($.territory != DB.EmptyRef("Catalog_Territory")) {
			DoChoose(null, outlet, attribute, control, TerritoryCallBack, title);
		}
	}
}

function CallBack(state, args) {
	AssignDialogValue(state, args);
	var outlet = state[0];
	DoRefresh(null, outlet);
}

function TerritoryCallBack(state, args) {
	var control = state[2];
	var attribute = state[1];
	if (getType(args.Result)=="BitMobile.DbEngine.DbRef") {
		$.territory = args.Result;
		control.Text = args.Result.Description;
	}
	else {
		$.territory = DB.EmptyRef("Catalog_Territory");
		control.Text = String.IsNullOrEmpty(args.Result) ? "—" : args.Result;
	}
}

function DoChoose(listChoice, entity, attribute, control, func, title) { //optional": func, title; listChice - nullable

	title = typeof title !== 'undefined' ? title : "#select_answer#";

	if (attribute==null)
		var startKey = control.Text;
	else
		var startKey = entity[attribute];

	if (listChoice==null){
		var tableName = entity[attribute].Metadata().TableName;
		var query = new Query();
		query.Text = "SELECT Id, Description FROM " + tableName;
		listChoice = query.Execute();
	}

	if (func == null)
		func = CallBack;

	Dialog.Choose(title, listChoice, startKey, func, [entity, attribute, control]);
}