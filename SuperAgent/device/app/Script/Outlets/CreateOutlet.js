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
				&& outlet.Type!=DB.EmptyRef("Catalog_OutletType") && outlet.Distributor!=DB.EmptyRef("Catalog_Distributor")) {
			var q = new Query("SELECT Ref FROM Catalog_Territory_SRs WHERE SR = @userRef LIMIT 1");+
			q.AddParameter("userRef", $.common.UserRef);
			var territory = q.ExecuteScalar();

			var to = DB.Create("Catalog.Territory_Outlets");
			to.Ref = territory;
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