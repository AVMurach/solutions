var itemsQty;
var mainTitle;
var infoTitle;
var sumTitle;
var skuTitle;
var infoTitleSmall;
var back;

function OnLoading(){

	if ($.workflow.currentDoc=='Order'){
		mainTitle = Translate["#order#"];
		infoTitle = Translate["#orderInfo#"];
		sumTitle = Translate["#orderSum#"];
		skuTitle = Translate["#skuInOrder#"];
		infoTitleSmall = Translate["#orderInfoSmall#"];
	}
	else{
		mainTitle = Translate["#return#"];
		infoTitle = Translate["#returnInfo#"];
		sumTitle = Translate["#returnSum#"];
		skuTitle = Translate["#skuInReturn#"];
		infoTitleSmall = Translate["#returnInfoSmall#"];
	}

	var menuItem = GlobalWorkflow.GetMenuItem();
	back = (menuItem == "Orders" || menuItem == "Returns" ? Translate["#clients#"] : Translate["#back#"]);

}

function OnLoad(){

	if ($.workflow.currentDoc=="Order" && parseInt(itemsQty) == parseInt(0)){

		var q_usr = new Query("CREATE TABLE IF NOT EXISTS USR_SKUQuestions (DocDate, SKU, SKUDescription, Question, Description, " +
				" AnswerType, ParentQuestion, QuestionOrder, IsInputField, KeyboardType, Single, Obligatoriness, OwnerGroup, Brand, " +
				" Answer, HistoryAnswer, AnswerDate )");
		q_usr.Execute();

		var q = new Query("SELECT COUNT(SKU) " + 
			GetAutoOrderText()
			);
		q.AddParameter("outlet", GlobalWorkflow.GetOutlet());
		q.AddParameter("priceList", $.workflow.order.PriceList);
		q.AddParameter("assignment", DB.Current.Constant.SKUQuestions.Stock);
		q.AddParameter("atVisit", $.workflow.name=='Visit');
		var hasSKUs = q.ExecuteScalar();

		if ($.sessionConst.UseAutoFillForRecOrder && parseInt(hasSKUs) != parseInt(0)){

			Dialog.Ask(Translate["#autoFillOrder#"], AutoFill);			

		}
	}
}

function AutoFill(state, args){	

	var q = new Query(" SELECT SKU, Unit, BaseUnitQty, Price, Qty, UnitId, RecUnit " +
		GetAutoOrderText()
		);
	q.AddParameter("outlet", GlobalWorkflow.GetOutlet());
	q.AddParameter("priceList", $.workflow.order.PriceList);
	q.AddParameter("assignment", DB.Current.Constant.SKUQuestions.Stock);
	q.AddParameter("atVisit", $.workflow.name=='Visit');

	var skus  = q.Execute();
	
	OrderItem.ClearItem();
	while (skus.Next()){
		if (parseFloat(skus.Qty) > parseFloat(0)){
			var args = new Dictionary;
			args.Add("basePrice", skus.Price);
			args.Add("Ref", $.workflow.order);
			args.Add("SKU", skus.SKU);
			args.Add("Units", skus.UnitId);
			args.Add("recOrder", skus.Qty);

			OrderItem.InitItem(args);
			OrderItem.ClearItem();
		}
	}

	DoRefresh(); 

}

function GetAutoOrderText(){
	return " FROM (" +
		" SELECT DISTINCT S.SKU, S.Unit, S.BaseUnitQty, P.Price, " +
		" CASE WHEN @atVisit THEN (CASE WHEN Q.Answer IS NULL THEN S.Qty ELSE (S.BaseUnitQty - Q.Answer) END) ELSE (CASE WHEN VA.Answer IS NULL THEN S.Qty ELSE (S.BaseUnitQty - VA.Answer) END)  END AS Qty, " +
		" CASE WHEN (@atVisit AND Q.Answer IS NOT NULL) OR (NOT @atVisit AND VA.Answer IS NOT NULL) THEN UB.Id ELSE U.Id END AS UnitId, " +
		" CASE WHEN (@atVisit AND Q.Answer IS NOT NULL) OR (NOT @atVisit AND VA.Answer IS NOT NULL) THEN UB.Description ELSE U.Description END AS RecUnit " +

		" FROM Catalog_AssortmentMatrix_Outlets AO " + 
		" JOIN Catalog_AssortmentMatrix_SKUs S ON AO.Ref=S.Ref " +
		" JOIN Document_PriceList_Prices P ON P.SKU=S.SKU AND P.Ref=@priceList " +
		" JOIN Catalog_SKU CS ON S.SKU=CS.Id " +
		" JOIN Catalog_UnitsOfMeasure UB ON CS.BaseUnit=UB.Id " +
		" LEFT JOIN Catalog_UnitsOfMeasure U ON S.Unit=U.Id " +
		" LEFT JOIN USR_SKUQuestions Q ON Q.SKU=S.SKU AND Q.Question IN (SELECT Id FROM Catalog_Question CQ WHERE CQ.Assignment=@assignment " +
		" LIMIT 1) " +
		" LEFT JOIN " +
			" (SELECT MAX(V.Date), V.Outlet AS VisitOutlet, V.Id " +
			" FROM Document_Visit V " +
			" WHERE DATE(V.Date)=DATE('now', 'localtime') " +
			" GROUP BY V.Outlet) VD ON AO.Outlet=VD.VisitOutlet " +
		" LEFT JOIN Document_Visit_SKUs VA ON VA.Ref=VD.Id AND VA.SKU=CS.Id " +
		" WHERE AO.Outlet=@outlet " +
		") " +
		" WHERE Qty > 0 ";
}

//-------------------------start screen------------------


function FindExecutedOrder(){
	if ($.Exists('executedOrder')) //this dirty hack is used in Events.js (OnApplicationRestore, OnWorkflowStart) too, think twice before edit here
		return $.executedOrder;
	else
		return null;
}


//--------------------------order----------------------


function GetPriceListRef(outlet) {
	var query = new Query("SELECT PriceList FROM Catalog_Outlet_Prices WHERE Ref = @Ref ORDER BY LineNumber LIMIT 1");
	query.AddParameter("Ref", outlet);
	var pl = query.ExecuteScalar();
	if (pl != null)
		return pl;
	var query = new Query("SELECT Id FROM Document_PriceList WHERE DefaultPriceList = @true LIMIT 1");
	query.AddParameter("true", true);
	return query.ExecuteScalar();
}

function GetOrderedSKUs(order) {

	var doc;
	if ($.workflow.currentDoc=="Order")
		doc = "Order";
	else
		doc = "Return";

	var query = new Query();
	query.Text = "SELECT Id, SKU, Feature, Qty, Discount, Total, Units, ROUND(Qty*Total, 2) AS Amount FROM Document_" + doc + "_SKUs WHERE Ref = @Ref";
	query.AddParameter("Ref", order);
	var r = query.Execute();
	itemsQty = query.ExecuteCount();
	$.skuTitleTV.Text = skuTitle +" (" + itemsQty + "):";
	return r;
}

function GetOrderSUM(order) {

	var doc;
	if ($.workflow.currentDoc=="Order")
		doc = "Order";
	else
		doc = "Return";

	var query = new Query("SELECT SUM(Qty*Total) FROM Document_" + doc + "_SKUs WHERE Ref = @Ref");
	query.AddParameter("Ref", order);
	var sum = query.ExecuteScalar();
	if (sum == null)
		return 0;
	else
		return String.Format("{0:F2}", sum);
}

function GetDescription(priceList) {
	if (priceList.EmptyRef())
		return Translate["#noPriceLists#"];
	else
		return (Translate["#priceList#"] + ": " + priceList.Description);
}

function GetFeatureDescr(feature) {
	if (feature.Code == "000000001" || $.sessionConst.SKUFeaturesRegistration==false)
		return "";
	else
		return (", " + feature.Description);
}

function CheckIfEmptyAndForward(order, wfName) {
	var empty = parseInt(itemsQty) == parseInt(0);

	if (wfName=="Visit"){
		if (empty){ //clearing parameters and delete order
			DB.Delete(order);
			var query = new Query("SELECT * FROM Document_" + $.workflow.currentDoc + "_Parameters WHERE Ref = @order")
			query.AddParameter("order", order);
			queryResult = query.Execute();
			while (queryResult.Next()) {
				DB.Delete(queryResult.Id);
			}

			if ($.workflow.currentDoc=="Order")
				$.workflow.Remove("order");
			if ($.workflow.currentDoc=="Return")
				$.workflow.Remove("Return");
		}
		else{
			var location = GPS.CurrentLocation;
			if (ActualLocation(location)) {
				var orderObj = order.GetObject();
				orderObj.Lattitude = location.Latitude;
				orderObj.Longitude = location.Longitude;
				orderObj.Save();
			}
		}
		Workflow.Forward([]);
	}

	else if (wfName=="Order" || wfName=="Return")
	{
		if (empty){
			DB.Delete(order);
			var query = new Query("SELECT * FROM Document_" + $.workflow.currentDoc + "_Parameters WHERE Ref = @order")
			query.AddParameter("order", order);
			queryResult = query.Execute();
			while (queryResult.Next()) {
				DB.Delete(queryResult.Id);
			}			
		}

		Workflow.Commit();
	}
}

function OrderBack() {

	if ($.workflow.name == "Order" || $.workflow.name == "Return")
		Workflow.Rollback();

	else {
		ClearFilters();

		var stepNumber;
		if ($.workflow.currentDoc=="Order")
			stepNumber = '4';
		else
			stepNumber = '5';

		var q = new Query("SELECT NextStep FROM USR_WorkflowSteps WHERE StepOrder<@stepNumber AND Value=0 ORDER BY StepOrder DESC");
		q.AddParameter("stepNumber", stepNumber);
		var step = q.ExecuteScalar();
		if (step==null) {
			Workflow.BackTo("Outlet");
		}
		else
			Workflow.BackTo(step);
	}
}

function ClearFilters() {
	var checkDropF = new Query("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='USR_Filters'");
	var checkDropFResult = checkDropF.ExecuteScalar();

	if (checkDropFResult == 1) {
		var dropF = new Query("DELETE FROM USR_Filters");
		dropF.Execute();
	}
}

function DeleteItem(item, executedOrder) {
	DB.Delete(item, true);
	Workflow.Refresh([ null, executedOrder ]);
}

function EditIfNew(order, orderItem) {
	orderItem = orderItem.GetObject();
	if (order.IsNew()){
		if (Variables.Exists("AlreadyAdded") == false)
			Variables.AddGlobal("AlreadyAdded", true);
		$.AddGlobal("itemFields", new Dictionary());
		$.itemFields.Add("Qty", orderItem.Qty);
		$.itemFields.Add("Price", orderItem.Price);
		$.itemFields.Add("Discount", orderItem.Discount);
		$.itemFields.Add("Total", orderItem.Total);
		$.itemFields.Add("Units", orderItem.Units);
		$.itemFields.Add("Feature", orderItem.Feature);
		$.itemFields.Add("Id", orderItem.Id);
		//for OrderItemInit
		$.itemFields.Add("SKU", orderItem.SKU);
		$.itemFields.Add("recOrder", orderItem.Qty);
		$.itemFields.Add("Ref", orderItem.Ref);	
		$.itemFields.Add("basePrice", GetBasePrice(order.PriceList, orderItem.SKU));

	    OrderItem.InitItem($.itemFields);

		Workflow.Action("Edit", []);
	}
}

function GetBasePrice(priceList, sku){
	var q = new Query("SELECT Price FROM Document_PriceList_Prices WHERE Ref=@priceList AND SKU=@sku");
	q.AddParameter("priceList", priceList);
	q.AddParameter("sku", sku);
	return q.ExecuteScalar();
}

function GetStock(userRef) {

	if ($.sessionConst.MultStck == false)
		return DB.EmptyRef("Catalog_Stock");
	var q = new Query("SELECT CS.Id, CS.Description " +
			" FROM Catalog_Stock CS " +
			" JOIN Catalog_Territory_Stocks CTS ON CS.Id = CTS.Stock " +
			" LEFT JOIN Catalog_Territory_Outlets CTO ON CTS.Ref = CTO.Ref " +
			" WHERE CTO.Outlet = @outlet ORDER BY CTS.LineNumber, CS.Description");
	q.AddParameter("outlet", outlet)
	var s = q.ExecuteScalar();
	if (s == null)
		return DB.EmptyRef("Catalog_Stock");
	else
		return s;
}

function CreateDocumentIfNotExists(executedOrder, visitId) {
	var outlet = GlobalWorkflow.GetOutlet();
	var userRef = $.common.UserRef;

	var order;
	if ($.workflow.currentDoc=="Order")
		order = $.workflow.HasValue("order")==true ? $.workflow.order : null;
	if ($.workflow.currentDoc=="Return")
		order = $.workflow.HasValue("Return")==true ? $.workflow.Return : null;

	var priceLists = GetPriceListQty(outlet);

	if (executedOrder != null) {
		order = executedOrder;
	} else {
		if (order == null) {
			if ($.workflow.currentDoc=="Order") {
				order = DB.Create("Document.Order");
				order.Status = DB.Current.Constant.OrderSatus.New;
			}
			else
				order = DB.Create("Document.Return");


			order.Date = DateTime.Now;
			order.Outlet = outlet;
			order.SR = userRef;
			order.DeliveryDate = DateTime.Now.AddDays(1);
			order.Stock = GetStock(userRef);
			order.Contractor = GetContractors(true, outlet);
			var location = GPS.CurrentLocation;
			if (ActualLocation(location)) {
				order.Lattitude = location.Latitude;
				order.Longitude = location.Longitude;
			}
			if (visitId != null)
				order.Visit = visitId;

			// if (priceLists >= parseInt(1)) {
			var pl = GetPriceListRef(outlet);
			if (pl != null)
				order.PriceList = pl;
			order.Save();
			order = order.Id;
			// }
		}
	}

	if ($.workflow.currentDoc=='Order')
		$.workflow.Add("order", order);
	else
		$.workflow.Add("Return", order);

	return order;

}

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

function GetPriceListRef(outlet) {
	var query = new Query("SELECT PriceList FROM Catalog_Outlet_Prices WHERE Ref = @Ref ORDER BY LineNumber LIMIT 1");
	query.AddParameter("Ref", outlet);
	var pl = query.ExecuteScalar();
	if (pl != null)
		return pl;
	var query = new Query("SELECT Id FROM Document_PriceList WHERE DefaultPriceList = @true LIMIT 1");
	query.AddParameter("true", true);
	return query.ExecuteScalar();
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