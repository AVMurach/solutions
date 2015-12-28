var swipedRow;
var alreadyAdded;
var forwardText;
var c_orderItem;
var c_itemsHistory;

function OnLoading(){
    alreadyAdded = $.Exists("AlreadyAdded");
    forwardText = alreadyAdded ? Translate["#editSKU#"] : Translate["#add#"];
    //#orderHistory#
    if ($.workflow.currentDoc=='Order')
        c_itemsHistory = Translate["#orderHistory#"];
    else
        c_itemsHistory = Translate["#returnHistory#"];
}

function GetCurrentItem(){
    return OrderItem.GetItem();
}


function GetCurrentDoc(){
    var d;
    if ($.workflow.currentDoc=='Order')
        d =  $.workflow.order;
    else
        d =  $.workflow.Return;
    return d;
}

function WriteSwipedRow(control){
    if(swipedRow != control)
        HideSwiped();
    swipedRow = control;
}

function OnScroll(sender)
{
    if($.grScrollView.ScrollIndex > 0 && swipedRow != $.grScrollView.Controls[$.grScrollView.ScrollIndex])
        HideSwiped();
}

function HideSwiped()
{
    if(swipedRow != null)
        swipedRow.Index = 1;
}

function GetFeatures(sku, stock) {
    var query = new Query(
            "SELECT DISTINCT Feature FROM Catalog_SKU_Stocks WHERE Ref=@Ref AND CASE WHEN @Stock = @EmptyStock THEN 1 ELSE Stock = @Stock END AND CASE WHEN @NoStkEnbl = 1 THEN 1 ELSE StockValue > 0 END ORDER BY LineNumber");
    query.AddParameter("Ref", sku);
    query.AddParameter("NoStkEnbl", $.sessionConst.NoStkEnbl);
    query.AddParameter("EmptyStock", DB.EmptyRef("Catalog_Stock"));
    query.AddParameter("Stock", stock);
    return query.Execute();
}



function SnapshotExists(sku, filename, filesTableName) {
	return Images.SnapshotExists(sku, ToString(filename), filesTableName);
}

//discount

function GetDiscountDescription(value) {
    if (parseFloat(value) == parseFloat(0)
            || parseFloat(value) < parseFloat(0))
        return Translate["#discount#"];
    else
        return Translate["#markUp#"];
}

function DiscountOutput(discount){
    if (String.IsNullOrEmpty(discount))
        return '0';
    else
        return discount.ToString();
}

function ApplyDiscount(sender, orderitem) {

    CheckUserInput(sender);

    if (Math.abs(parseFloat(sender.Text)) > 100)
        sender.Text =  sender.Text > 0 ? 100 : -100;
}

function RefreshDiscount(sender, param1, orderitem){
    
    sender.Text = String.IsNullOrEmpty(sender.Text) ? '0' : sender.Text;

    if (parseFloat(sender.Text) != parseFloat(orderitem.Discount))
    {
        SendDiscountMap(sender.Text);
        DoRefresh(param1);
    }
}

function SendDiscountMap(discount){
    var d = new Dictionary();
    d.Add("Discount", String.IsNullOrEmpty(discount) 
                            ? parseFloat(0) 
                            : parseFloat(discount));
    OrderItem.SetItemValue(d);
}

function RefreshScreen(control, param1){
    DoRefresh(param1);
}

function ConvertDiscount(control) {
    SendDiscountMap(-1 * control.Text);
    DoRefresh($.showimage);
}

//total discount

function GetTotalDiscount(){
    return FormatValue(OrderItem.GetTotalDiscount());
}

function ApplyTotalDiscount(sender, orderitem){

    CheckUserInput(sender);

    if (!String.IsNullOrEmpty(sender.Text)){
        if (sender.Text < -orderitem.Price)
            sender.Text = -orderitem.Price;
    }    
}

function RefreshTotalDiscount(sender, param1){

    sender.Text = String.IsNullOrEmpty(sender.Text) ? FormatValue(0) : sender.Text;

    if (parseFloat(sender.Text) != parseFloat(OrderItem.GetTotalDiscount()))
    {
        SendTotalDiscountMap(sender.Text);        
        DoRefresh(param1);
    }
    
}

function SendTotalDiscountMap(discount){
    var d = new Dictionary();
    d.Add("TotalDiscount", String.IsNullOrEmpty(discount) 
                            ? parseFloat(0) 
                            : parseFloat(discount));
    OrderItem.SetItemValue(d);
}

function GetTotalDiscountDescription(){
    
    var value = OrderItem.GetTotalDiscount();

    if (parseFloat(value) == parseFloat(0)
            || parseFloat(value) < parseFloat(0))
        return Translate["#sumDiscount#"];
    else
        return Translate["#sumMarkUp#"];
}

function ConvertTotalDiscount(control, orderitem){    
    SendTotalDiscountMap(-1 * control.Text);
    DoRefresh($.showimage);
}

//total

function TotalOutput(total){
    return FormatValue(total);
}

function ApplyTotal(sender, orderitem){

    CheckUserInput(sender);
    if (String.IsNullOrEmpty(sender.Text))
        sender.Text = '0';
    if (sender.Text < 0)
    {
        sender.Text = -1 * sender.Text;
    }

    var d = new Dictionary();
    d.Add("Total", parseFloat(sender.Text));
    OrderItem.SetItemValue(d);

    orderitem = OrderItem.GetItem();
    $.orderitem = orderitem;

    // DoRefresh($.showimage);

}

function GetFeatureDescr(feature) {
    if (feature.Code == "000000001" || $.sessionConst.SKUFeaturesRegistration==false)
        return "";
    else
        return (", " + feature.Description);
}

function GetImagePath(objectID, pictID, pictExt) {
  return Images.FindImage(objectID, ToString(pictID), pictExt, "Catalog_SKU_Files");
}

function ImageActions(imageControl, sku) {
	Images.AddSnapshot(sku, sku, GalleryCallBack, sku.Description, imageControl.Source, false);
}

function GalleryCallBack(state, args) {
	if (args.Result){
		var sku = state[0];
		var fileName = state[1];

		sku = sku.GetObject();
		sku.DefaultPicture = fileName;
		sku.Save();

		Workflow.Refresh([$.showimage]);
	}
}

function ChangeFeatureAndRefresh(orderItem, feature, showimage) {

    if (orderItem.Feature != feature.Feature) {
        var d = new Dictionary();
        d.Add("Feature", feature);
        OrderItem.SetItemValue(d);

        DoRefresh(showimage);
    }
}

function ChangeUnit(sku, orderitem) {

    HideSwiped();

    var q1 = new Query(
            "SELECT LineNumber FROM Catalog_SKU_Packing WHERE Pack=@pack AND Ref=@ref");
    q1.AddParameter("ref", sku);
    q1.AddParameter("pack", orderitem.Units);
    var currLineNumber = q1.ExecuteScalar();

    var q2 = new Query(
            "SELECT Pack, Multiplier FROM Catalog_SKU_Packing WHERE Ref=@ref AND LineNumber=@lineNumber");
    q2.AddParameter("ref", sku);
    q2.AddParameter("lineNumber", currLineNumber + 1);
    var selectedUnit = q2.Execute();
    if (selectedUnit.Pack == null) {
        q2 = new Query(
                "SELECT Pack, Multiplier FROM Catalog_SKU_Packing WHERE Ref=@ref AND LineNumber=@lineNumber");
        q2.AddParameter("ref", sku);
        q2.AddParameter("lineNumber", 1);
        var selectedUnit = q2.Execute();
    }

    var args = new Dictionary();
    args.Add("Units", selectedUnit.Pack);
    args.Add("Multiplier", selectedUnit.Multiplier);

    OrderItem.SetItemValue(args);
    orderitem = OrderItem.GetItem();

    // $.itemUnits.Text = orderitem.Units.Description;    
    // $.orderItemTotalId.Text = FormatValue(orderitem.Total);
    // $.totalEdit.Text = FormatValue(orderitem.Total);

    DoRefresh($.showimage);

}

function GetItemHistory(sku, order) {
    var q = new Query("SELECT D.Date AS Date, S.Qty*P.Multiplier AS Qty, " +
        "S.Total/P.Multiplier AS Total, S.Discount, S.Price/P.Multiplier AS Price " +
        "FROM Document_" + $.workflow.currentDoc + "_SKUs S " +
        "JOIN Document_" + $.workflow.currentDoc + " D ON S.Ref=D.Id " +
        "JOIN Catalog_SKU_Packing P ON S.SKU=P.Ref AND P.Pack=S.Units " +
        "WHERE D.Outlet=@outlet AND S.SKU=@sku AND S.Ref<>@ref " +
        "ORDER BY D.Date DESC LIMIT 4");
    q.AddParameter("outlet", order.Outlet);
    q.AddParameter("sku", sku);
    q.AddParameter("ref", order);

    $.Add("historyCount", q.ExecuteCount());

    return q.Execute();
}

function CalculateSKUAndForward(outlet, orderitem) {

    if (Converter.ToDecimal(orderitem.Qty) == Converter.ToDecimal(0)) {
        DB.Delete(orderitem);
    } else {
        Global.FindTwinAndUnite(orderitem.GetObject());
        GlobalWorkflow.SetMassDiscount(null);
        GlobalWorkflow.GetMassDiscount(orderitem.Ref);
    }

    if ($.Exists("itemFields"))
    	$.Remove("itemFields");
    if ($.Exists("AlreadyAdded"))
    	$.Remove("AlreadyAdded");

    OrderItem.ClearItem();

    if (alreadyAdded)
        DoAction('Show' + $.workflow.currentDoc);
    else
        DoForward();
}

function DeleteAndBack(orderitem) {
    if (Variables.Exists("AlreadyAdded") == false) {
        DB.Delete(orderitem);
    } else{
        orderitem = orderitem.GetObject();
        orderitem.Qty = $.itemFields.Qty;
        orderitem.Price = $.itemFields.Price;
        orderitem.Discount = $.itemFields.Discount;
        orderitem.Total = $.itemFields.Total;
        orderitem.Units = $.itemFields.Units;
        orderitem.Feature = $.itemFields.Feature;
        orderitem.Save();
        $.Remove("AlreadyAdded");
    }
    if ($.Exists("itemFields"))
    	$.Remove("itemFields");

    OrderItem.ClearItem();
    GlobalWorkflow.GetMassDiscount(orderitem.Ref);

    Workflow.Back();
}

function RepeatOrder(orderitem, qty, discount, baseUnit, baseUnitDescr, price, total){

    var totalDiscount = total - price;

    var d = new Dictionary();
    
    d.Add("Qty", qty);

    if (parseFloat(discount)!=parseFloat(0))
        d.Add("Discount", discount);
    else if (totalDiscount != 0)
        d.Add("TotalDiscount", totalDiscount);
    
    d.Add("Units", baseUnit);

    d.Add("Multiplier", 1);

    OrderItem.SetItemValue(d);

    DoRefresh($.showimage);

}

function FormatDate(datetime) {
    return Format("{0:d}", Date(datetime));
}
