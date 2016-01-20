var infoTitle;
var sumTitle;
var infoTitleSmall;
var c_parameterDescription;
var c_docParams;

function OnLoading(){

	if ($.workflow.currentDoc=='Order'){
		infoTitle = Translate["#orderInfo#"];
		sumTitle = Translate["#orderSum#"];
		infoTitleSmall = Translate["#orderInfoSmall#"];
		c_docParams = Translate["#orderParameters#"];
	}
	else{
		infoTitle = Translate["#returnInfo#"];
		sumTitle = Translate["#returnSum#"];
		infoTitleSmall = Translate["#returnInfoSmall#"];
		c_docParams = Translate["#returnParameters#"];
	}

}


//----------------------------------------


function GetPriceListQty(outlet) {
	var query = new Query("SELECT DISTINCT D.Id, D.Description FROM Catalog_Outlet_Prices O JOIN Document_PriceList D ON O.PriceList=D.Id WHERE O.Ref = @Ref ORDER BY O.LineNumber");
	query.AddParameter("Ref", outlet);
	var pl = query.ExecuteCount();
	if (parseInt(pl) == parseInt(0)) {
		var query = new Query("SELECT Id FROM Document_PriceList WHERE DefaultPriceList = @true");
		query.AddParameter("true", true);
		return query.ExecuteCount();
	} else
		return pl;

}

function ApplyComment(sender, thisDoc){ //dirty hack, see SUPA-1784
	var obj = thisDoc.GetObject();
	obj.Commentary = sender.Text;
	obj.Save();
}

function HasOrderParameters() {

	var query = new Query("SELECT DISTINCT Id From Catalog_OrderParameters WHERE Visible = 1");
	orderParametersCount = query.ExecuteCount();
	return orderParametersCount > 0;

}

function GetOrderParameters(outlet) {
	var query = new Query("SELECT P.Id, P.Description, P.DataType, DT.Description AS TypeDescription, " +
		" OP.Id AS ParameterValue, OP.Value, P.Visible, P.Editable, " +
		" CASE WHEN P.DataType=@integer OR P.DataType=@decimal OR P.DataType=@string " +
		" THEN 1 ELSE 0 END AS IsInputField, " +
		" CASE WHEN P.DataType=@integer OR P.DataType=@decimal THEN 'numeric' " +
		" ELSE 'auto' END AS KeyboardType, " +
		" CASE WHEN P.DataType=@integer OR P.DataType=@decimal OR P.DataType=@string " +
		" THEN OP.Value ELSE " +
		" CASE WHEN OP.Value IS NULL OR RTRIM(OP.Value)='' THEN '—'	" +
		" ELSE OP.Value END " +
		" END AS AnswerOutput " +
		" FROM Catalog_OrderParameters P " +
		" JOIN Enum_DataType DT On DT.Id=P.DataType " +
		" LEFT JOIN Document_"+$.workflow.currentDoc+"_Parameters OP ON OP.Parameter = P.Id AND OP.Ref = @outlet " +
		" WHERE NOT P.DataType=@snapshot");
	query.AddParameter("integer", DB.Current.Constant.DataType.Integer);
	query.AddParameter("decimal", DB.Current.Constant.DataType.Decimal);
	query.AddParameter("string", DB.Current.Constant.DataType.String);
	query.AddParameter("snapshot", DB.Current.Constant.DataType.Snapshot);
	query.AddParameter("outlet", outlet);
	query.AddParameter("attached", Translate["#snapshotAttached#"]);
	result = query.Execute();
	return result;
}

function CreateOrderParameterValue(order, parameter, value, parameterValue, isInputField) {
	var q = new Query("SELECT Id FROM Document_"+ $.workflow.currentDoc +"_Parameters WHERE Ref=@ref AND Parameter = @parameter");
	q.AddParameter("ref", order);
	q.AddParameter("parameter", parameter);
	parameterValue = q.ExecuteScalar();
	if (parameterValue == null) {
		parameterValue = DB.Create("Document."+$.workflow.currentDoc+"_Parameters");
		parameterValue.Ref = order;
		parameterValue.Parameter = parameter;
	} else{
		parameterValue = parameterValue.GetObject();
		if (isInputField)
			parameterValue.Value = value;
	}
	parameterValue.Save();
	return parameterValue.Id;
}

function AssignParameterValue(control, typeDescription, parameterValue, value, order, parameter) {
	CreateOrderParameterValue(order, parameter, control.Text, parameterValue, true)
}

function GoToParameterAction(typeDescription, parameterValue, value, order, parameter, control, parameterDescription, editable, isInputField) {

	if (IsNew(order)) {
		if (editable) {

			c_parameterDescription = parameterDescription;
			parameterValue = CreateOrderParameterValue(order, parameter, parameterValue, parameterValue, isInputField);

			if (typeDescription == "ValueList") {  //--------ValueList-------
				var q = new Query();
				q.Text = "SELECT Value, Value FROM Catalog_OrderParameters_ValueList WHERE Ref=@ref UNION SELECT '', '—' ORDER BY Value";
				q.AddParameter("ref", parameter);
				Dialogs.DoChoose(q.Execute(), parameterValue, "Value", Variables[control], null, parameterDescription);
			}
			if (typeDescription == "DateTime") {  //---------DateTime-------
				if (String.IsNullOrEmpty(parameterValue.Value))
					Dialogs.ChooseDateTime(parameterValue, "Value", Variables[control], DateHandler, parameterDescription);
				else
					Dialog.Choose(parameterDescription, [[0, Translate["#clearValue#"]], [1, Translate["#setDate#"]]], DateHandler, [parameterValue, control]);
			}
			if (typeDescription == "Boolean") {  //----------Boolean--------
				Dialogs.ChooseBool(parameterValue, "Value", Variables[control], null, parameterDescription);
			}
			if (typeDescription == "String" || typeDescription == "Integer" || typeDescription == "Decimal") {
				FocusOnEditText(control, '1');
			}
		}
	}
}

function DateHandler(state, args) {
	var parameterValue = state[0];
	var control = state[1];
	if(getType(args.Result)=="System.DateTime"){
		parameterValue = parameterValue.GetObject();
		parameterValue.Value = Format("{0:dd.MM.yyyy HH:mm}", Date(args.Result));
		parameterValue.Save();
		Workflow.Refresh([$.sum, $.executedOrder, $.thisDoc]);
	}
	if (parseInt(args.Result)==parseInt(0)){
		parameterValue = parameterValue.GetObject();
		parameterValue.Value = "";
		parameterValue.Save();
		Workflow.Refresh([$.sum, $.executedOrder, $.thisDoc]);
	}
	if (parseInt(args.Result)==parseInt(1)){
		Dialogs.ChooseDateTime(parameterValue, "Value", Variables[control], DateHandler, c_parameterDescription);
	}
}

function IsEditText(isInputField, editable, order) {
	if (isInputField && editable && IsNew(order)) {
		return true;
	} else {
		return false;
	}
}

function SelectStock(order, outlet, attr, control) {
	if (IsNew(order) && NotEmptyRef(order.PriceList)) {
		var q = new Query("SELECT CS.Id, CS.Description " +
			" FROM Catalog_Stock CS " +
			" JOIN Catalog_Territory_Stocks CTS ON CS.Id = CTS.Stock " +
			" LEFT JOIN Catalog_Territory_Outlets CTO ON CTS.Ref = CTO.Ref " +
			" WHERE CTO.Outlet = @outlet ORDER BY CTS.LineNumber, CS.Description");
		q.AddParameter("outlet", outlet);
		var res = q.Execute().Unload();
		if (res.Count() > 1) {
			var table = [];
			table.push([ DB.EmptyRef("Catalog_Stock"), Translate["#allStocks#"] ]);
			while (res.Next()) {
				table.push([ res.Id, res.Description ]);
			}
			Dialogs.DoChoose(table, order, attr, control, StockSelectHandler, Translate["#stockPlace#"]);
		}
	}
}

function StockSelectHandler(state, args) {
	var entity = AssignDialogValue(state, args);

	var control = state[2];
	if (args.Result.EmptyRef())
		control.Text = Translate["#allStocks#"];
	else
		control.Text = args.Result.Description;
	ReviseSKUs($.workflow.order, $.workflow.order.PriceList, args.Result);
	return;
}

function SelectContractor(thisDoc)
{
	if (IsNew(thisDoc) && NotEmptyRef(thisDoc.PriceList)){
		var listChoice = GetContractors(false, thisDoc.Outlet);
		Dialogs.DoChoose(listChoice, thisDoc, "Contractor", $.contractor, null, Translate["#contractor#"]);
	}
}

function GetContractors(chooseDefault, outletRef)
{
	var outlet = outletRef.GetObject();
	var defStr = "";
	var result;
	if (chooseDefault)
		defStr = " AND Isdefault=1 ";

	if (outlet.Distributor==DB.EmptyRef("Catalog.Distributor"))
	{
		var q = new Query("SELECT C.Id, C.Description " +
			"FROM Catalog_Outlet_Contractors O " +
			"JOIN Catalog_Contractors C ON O.Contractor=C.Id " +
			"WHERE O.Ref=@outlet " + defStr + " ORDER BY C.Description");
		q.AddParameter("outlet", outlet.Id);
		result = q.Execute();
	}
	else
	{
		var q = new Query("SELECT  C.Id, C.Description " +

			" FROM Catalog_Distributor_Contractors DC " +
			" JOIN Catalog_Territory_Contractors TC ON DC.Contractor=TC.Contractor " +
			" JOIN Catalog_Territory_Outlets T ON TC.Ref=T.Ref AND T.Outlet=@outlet " +
			" JOIN Catalog_Contractors C ON C.Id=TC.Contractor " +

			" WHERE DC.Ref=@distr " + defStr + "ORDER BY IsDefault desc, C.Description");
		q.AddParameter("outlet", outlet.Id);
		q.AddParameter("distr", outlet.Distributor);
		result = q.Execute();
	}

	if (chooseDefault)
		return result.Id;
	else
		return result;
}

function GetStockDescription(stock) {
	if (stock.EmptyRef())
		return Translate["#allStocks#"];
	else
		return stock.Description;
}

function RefOutput(value)
{
	if (value == DB.EmptyRef("Catalog.Contractors"))
		return "—";
	else
		return value.Description;
}

function SelectPriceListIfIsNew(order, priceLists, executedOrder) {
	if (IsNew(order))
		SelectPriceList(order, priceLists, executedOrder);
}

function IsEditable(executedOrder, order) {
	return executedOrder == null && IsNew(order) && NotEmptyRef(order.PriceList);
}

function SetDeliveryDateDialog(order, control, executedOrder, title) {
	if (IsNew(order) && NotEmptyRef(order.PriceList))
		Dialogs.ChooseDateTime(order, "DeliveryDate", control, DeliveryDateCallBack, title);
}

function FormatDate(datetime) {
	return Format("{0:g}", Date(datetime));
}

function SelectPriceList(order, priceLists, executedOrder) {
	if (parseInt(priceLists) != parseInt(1) && parseInt(priceLists) != parseInt(0) && executedOrder == null) {
		var query = new Query("SELECT DISTINCT D.Id, D.Description FROM Catalog_Outlet_Prices O JOIN Document_PriceList D ON O.PriceList=D.Id WHERE O.Ref = @Ref ORDER BY O.LineNumber");
		query.AddParameter("Ref", order.Outlet);
		var pl = query.ExecuteCount();
		if (parseInt(pl) == parseInt(0)) {
			var query = new Query("SELECT Id, Description FROM Document_PriceList WHERE DefaultPriceList = @true");
			query.AddParameter("true", true);
		}
		var table = query.Execute();
		PriceListSelect(order, "PriceList", table, Variables["priceListTextView"]);
	}
}

function PriceListSelect(entity, attribute, table, control) {
	Dialogs.DoChoose(table, entity, attribute, control, DoPriceListCallback, Translate["#priceList#"]);
	return;
}

function DoPriceListCallback(state, args) {
	var order = state[0];
	var oldPriceList = order[state[1]];
	if ((oldPriceList.ToString()==(args.Result).ToString())){
		return;
	}

	var entity = order;
	var newPriceList = args.Result;

	if (OrderWillBeChanged(entity, newPriceList)) {
		Dialog.Ask(Translate["#" + $.workflow.currentDoc + "skuWillBeDeleted#"], PositiveCallback, [entity, newPriceList, state[2]]);
	}
	else {
		var control = state[2];
		control.Text = args.Result.Description;
		AssignDialogValue(state, args);
		ReviseSKUs(entity, args.Result, entity.Stock);
	}
	return;
}

function OrderWillBeChanged(order, newPriceList) {
	var query = new Query(
		"SELECT DISTINCT " +
		" O.SKU " +
		" FROM Document_" + $.workflow.currentDoc + "_SKUs O " +
		" LEFT JOIN Document_PriceList_Prices P ON O.SKU = P.SKU AND P.Ref = @priceList " +
		" WHERE	" +
		" O.Ref = @order AND P.Ref IS NULL");
	query.AddParameter("order", order);
	query.AddParameter("priceList", newPriceList);
	count = query.ExecuteCount();
	return count > 0;
}

function PositiveCallback(state, args) {
	var order = state[0];
	var priceList = state[1];
	var control = state[2];

	order = order.GetObject();
	order.PriceList = priceList;
	order.Save();

	control.Text = priceList.Description;
	ReviseSKUs(order.Id, priceList, order.Stock);
}

function DeliveryDateCallBack(state, args){
	AssignDialogValue(state, args);
	$.deliveryDate.Text = Format("{0:g}", Date(args.Result));
}

function ReviseSKUs(order, priceList, stock) {

	var q = new Query("SELECT Id FROM Document_" + $.workflow.currentDoc + "_SKUs WHERE Ref=@ref");
	q.AddParameter("ref", entity);
	if (parseInt(q.ExecuteCount()) != parseInt(0))
		Dialog.Message(Translate["#" + $.workflow.currentDoc + "SKUWillRevised#"]);

	var query = new Query();
	query.Text = "SELECT O.Id, O.Qty, O.Discount, O.Price, O.Total, " +
	" O.Amount, P.Price AS NewPrice, SS.StockValue AS NewStock, SP.Multiplier " +
	" FROM Document_" + $.workflow.currentDoc + "_SKUs O " +
	" LEFT JOIN Document_PriceList_Prices P ON O.SKU=P.SKU AND P.Ref = @priceList " +
	" LEFT JOIN Catalog_SKU_Stocks SS ON SS.Ref=O.SKU AND SS.Stock = @stock " +
	" JOIN Catalog_SKU_Packing SP ON O.Units=SP.Pack AND SP.Ref=O.SKU " +
	" WHERE O.Ref=@order";
	query.AddParameter("order", order);
	query.AddParameter("priceList", priceList);
	query.AddParameter("stock", stock);
	var SKUs = query.Execute();

	while (SKUs.Next()) {
		if (SKUs.NewStock == null && order.Stock.EmptyRef() == false)
			DB.Delete(SKUs.Id);
		else {
			if (SKUs.NewPrice == null)
				DB.Delete(SKUs.Id);
			else {
				var sku = SKUs.Id;
				sku = sku.GetObject();
				sku.Price = SKUs.NewPrice * SKUs.Multiplier;
				sku.Total = (sku.Discount / 100 + 1) * sku.Price;
				sku.Amount = sku.Qty * sku.Total;
				sku.Save();
			}
		}
	}

	return;
}

//mass discount

function MassDiscount(thisDoc){
	var d = GlobalWorkflow.GetMassDiscount(thisDoc);
	var output = String.IsNullOrEmpty(d) ? '0' : d.ToString();
	$.massDiscountDescription.Text = OrderDiscountDescription(output);
	return output;
}

function SetMassDiscount(sender, thisDoc){  
	
	var massDisc = MassDiscount(thisDoc);

	if (parseFloat(massDisc)!=parseFloat(sender.Text)){
		if (String.IsNullOrEmpty(sender.Text))
			sender.Text = '0';

		var t = new Query("SELECT MAX " + 
			"(CASE WHEN Price=Total THEN 0 " +
				" ELSE 1 " +
				" END ) " +
			" FROM Document_"+ $.workflow.currentDoc +"_SKUs " +
			" WHERE Ref=@ref");
		t.AddParameter("ref", thisDoc);
		var result = t.ExecuteScalar() == null ? 0 : t.ExecuteScalar();
		if (parseInt(result) == parseInt(1))
			Dialog.Message(Translate["#orderDiscountReset#"]);

		var discount = sender.Text;
		GlobalWorkflow.SetMassDiscount(discount); 
		var q = new Query("SELECT Id, Price, Total " +
			" FROM Document_"+ $.workflow.currentDoc +"_SKUs " +
			" WHERE Ref=@ref");
		q.AddParameter("ref", thisDoc);
		var sku = q.Execute();

		while (sku.Next()){
			var skuObj = sku.Id.GetObject();
			skuObj.Discount = discount;
			skuObj.Total = skuObj.Price * (1 + discount/100);
			skuObj.Amount = skuObj.Total * skuObj.Qty;
			skuObj.Save();

			Global.FindTwinAndUnite(skuObj);
		}

		$.massDiscountDescription.Text = OrderDiscountDescription(discount);
	}	
}

function OrderDiscountDescription(value){

	if (parseFloat(value) == parseFloat(0)
            || parseFloat(value) < parseFloat(0) || value==null)
        return Translate["#"+ $.workflow.currentDoc +"Discount#"];
    else
        return Translate["#"+ $.workflow.currentDoc +"MarkUp#"];
}

function ConvertDiscount(control, thisDoc) {
    control.Text = -1 * control.Text;
    SetMassDiscount(control, thisDoc);
}

function ApplyDiscount(sender){
	
	CheckUserInput(sender);

    if (Math.abs(parseFloat(sender.Text)) > 100)
        sender.Text =  sender.Text > 0 ? 100 : -100;
}