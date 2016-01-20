var listTitle;
var back;
var no_docs;

function OnLoading(){

	if ($.workflow.step=='OrderList'){
		listTitle = Translate["#orders#"];
		no_docs = Translate["#no_orders#"];
	}
	else{
		listTitle = Translate["#returns#"];
		no_docs = Translate["#no_returns#"];
	}	

	var menuItem = GlobalWorkflow.GetMenuItem();
	back = (menuItem == "Orders" || menuItem == "Returns" ? Translate["#clients#"] : Translate["#back#"]);

}


//---------------------------UI calls----------------

function NoOrders(){	

	if ($.workflow.step=='OrderList') {
		var q = new Query("SELECT COUNT(DO.Id) " +
			" FROM Document_Order DO ");		
	}
	else{
		var q = new Query("SELECT COUNT(DO.Id) " +
			" FROM Document_Return DO ");
	}

	var c = q.ExecuteScalar();

	if (parseInt(c) == parseInt(0))
		return true;
	else
		return false;
}

function GetItems() {

	var q = new Query();

	if ($.workflow.step=='OrderList') {
		q.Text = "SELECT DO.Id, DO.Outlet, strftime('%d/%m/%Y', DO.Date) AS Date, DO.Number, " +
		" CO.Description AS OutletDescription, DO.Status " +
		" FROM Document_Order DO JOIN Catalog_Outlet CO ON DO.Outlet=CO.Id ORDER BY DO.Date DESC LIMIT 100";
	}
	else{
		q.Text = "SELECT DO.Id, DO.Outlet, strftime('%d/%m/%Y', DO.Date) AS Date, DO.Number, " +
		" CO.Description AS OutletDescription, NULL AS Status " +
		" FROM Document_Return DO " +
		" JOIN Catalog_Outlet CO ON DO.Outlet=CO.Id ORDER BY DO.Date DESC LIMIT 100";
	}

	return q.Execute();
}

function SelectOrder(order, outlet){
	order = order.GetObject();
	GlobalWorkflow.SetOutlet(outlet);
	$.AddGlobal("executedOrder", order.Id);
	DoAction('Edit');
}

function OrderCanceled(status) {
	if ($.workflow.step == "OrderList") {
		if (status.ToString() == (DB.Current.Constant.OrderSatus.Canceled).ToString())
			return true;
	}
	return false;
}

function AssignNumberIfNotExist(number) {

	if (number == null)
		var number = Translate["#noNumber#"];

	return number;

}

