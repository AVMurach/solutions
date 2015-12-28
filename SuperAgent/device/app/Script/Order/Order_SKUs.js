var defFeature;
var defPack;
var defMultiplier;
var packDescription;
var swipedRow;
var rec_order;
var doRecommend;
var doGroupping;
var alreadyOrdered;

function OnLoading() {
    rec_order = "<font size=''>1576 шт.</font>";
    doGroupping = DoGroupping();
    doRecommend = DoRecommend();
    if ($.workflow.currentDoc=="Order")
        alreadyOrdered = Translate["#alreadyOrdered#"];
    else
        alreadyOrdered = Translate["#alreadyReturned#"]
}

function GetCurrentDoc(){
    var d = DB.EmptyRef("Document_Order");
    if ($.workflow.currentDoc=='Order')
        d =  $.workflow.order;
    if ($.workflow.currentDoc=='Return')
        d =  $.workflow.Return;
    return d;
}

function GetSKUAndGroups(searchText, thisDoc) {

     var priceList = thisDoc.PriceList;
     var stock = thisDoc.Stock;

    var filterString = "";

    filterString = AddFilter(filterString, "group_filter", "S.Owner", "OF");
    filterString = AddFilter(filterString, "brand_filter", "S.Brand", "BF");

    var groupFields = "";
    var groupJoin = " INDEXED BY IND_SKUBRAND ON PL.SKU = S.Id ";
    var groupParentJoin = "";
    var groupSort = "";
    var groupWhere = "";
    if (doGroupping){
        groupFields = " G.Description AS GroupDescription, G.Id AS GroupId, G.Parent AS GroupParent, P.Description AS ParentDescription, ";
        groupJoin = " INDEXED BY IND_SKUOWNERBRAND ON PL.SKU = S.Id JOIN _Catalog_SKUGroup G INDEXED BY IND_SKUGROUPPARENT ON G.Id = S.Owner ";
        groupParentJoin = "LEFT JOIN Catalog_SKUGroup P ON G.Parent=P.Id ";
        groupWhere = " AND G.IsTombstone = 0 ";
        if (thisDoc.Stock.EmptyRef()==true){
          groupSort = " G.Description, ";
        } else {
          groupSort = " GroupDescription, ";
        }
    }

    var query = new Query();

    var searchString = "";

    if (String.IsNullOrEmpty(searchText) == false) {
        searchText = StrReplace(searchText, "'", "''");
        searchString = " AND Contains(S.Description, '" + searchText + "') ";
    }

    if (doRecommend && $.workflow.currentDoc=="Order"){

        var recOrderFields = ", CASE WHEN V.Answer IS NULL THEN U.Description ELSE UB.Description END AS RecUnit " +
                             ", CASE WHEN V.Answer IS NULL THEN U.Id ELSE UB.Id END AS UnitId " +
                             ", CASE WHEN V.Answer IS NULL THEN MS.Qty ELSE (MS.BaseUnitQty-V.Answer) END AS RecOrder " +
                             ", CASE WHEN MS.Qty IS NULL THEN 0 ELSE CASE WHEN (MS.BaseUnitQty-V.Answer)>0 OR (V.Answer IS NULL AND MS.Qty>0) THEN 2 ELSE 1 END END AS OrderRecOrder ";

        var recOrderStr =   "JOIN Catalog_UnitsOfMeasure UB ON S.BaseUnit=UB.Id " +
                            "LEFT JOIN Catalog_AssortmentMatrix_Outlets O ON O.Outlet=@outlet " +
                            "LEFT JOIN Catalog_AssortmentMatrix_SKUs MS ON S.Id=MS.SKU AND MS.BaseUnitQty IN " +
                                     " (SELECT MAX(SS.BaseUnitQty) FROM Catalog_AssortmentMatrix_SKUs SS " +
                                     " JOIN Catalog_AssortmentMatrix_Outlets OO ON SS.Ref=OO.Ref    " +
                                     " WHERE Outlet=@outlet AND SS.SKU=MS.SKU LIMIT 1) " +
                            "LEFT JOIN Catalog_UnitsOfMeasure U ON MS.Unit=U.Id " +
                            "LEFT JOIN USR_SKUQuestions V ON MS.SKU=V.SKU AND V.Question IN (SELECT Id FROM Catalog_Question CQ WHERE CQ.Assignment=@assignment)";

        query.AddParameter("outlet", $.workflow.outlet);
        query.AddParameter("assignment", DB.Current.Constant.SKUQuestions.Stock);

        var recOrderSort = " OrderRecOrder DESC, ";

    } else if ($.workflow.name=='Order'){

        var recOrderFields = ", NULL AS RecUnit " +
                             ", NULL AS UnitId " +
                             ", 0 AS RecOrder " +
                             ", CASE WHEN MS.Qty IS NULL THEN 0 ELSE 1 END AS OrderRecOrder "

        var recOrderStr =  "LEFT JOIN (SELECT SS.Ref, SS.SKU, SS.Qty, SS.Unit, SS.BaseUnitQty FROM Catalog_AssortmentMatrix_SKUs SS " +
                                     " JOIN _Catalog_AssortmentMatrix_Outlets OO INDEXED BY IND_AMREFOUTLET ON SS.Ref=OO.Ref " +
                                     " WHERE OO.Outlet=@outlet AND OO.IsTombstone = 0) MS ON S.Id=MS.SKU ";

        query.AddParameter("outlet", $.workflow.outlet);
        query.AddParameter("visit", $.workflow.visit);

        var recOrderSort = " OrderRecOrder DESC, ";
    }
    else{
        var recOrderFields = ", NULL AS RecUnit " +
                     ", NULL AS UnitId " +
                     ", 0 AS RecOrder " +
                     ", 0 AS OrderRecOrder ";
        
        var recOrderStr = "";

        var recOrderSort = "";
    }

    if (stock.EmptyRef()==true){

    	if ($.sessionConst.NoStkEnbl || $.workflow.currentDoc=='Return') {
            var stockCondition = "";
        } else {
            var stockCondition = " AND S.CommonStock > 0 ";
    	}

	    query.Text = "SELECT DISTINCT S.Id, S.Description, PL.Price AS Price, S.CommonStock AS CommonStock, " +
	            groupFields +
	            "CB.Description AS Brand " +
	            recOrderFields +
	            "FROM _Document_PriceList_Prices PL INDEXED BY IND_PLREFSKU " +
	            "JOIN _Catalog_SKU S " +
	            groupJoin + groupWhere +
	            "JOIN Catalog_Brands CB ON CB.Id=S.Brand " +
	            groupParentJoin +
	            recOrderStr + filterString +
	            " WHERE PL.Ref = @Ref AND PL.IsTombstone = 0 AND S.IsTombstone = 0 " + stockCondition + searchString +
	            " ORDER BY " + groupSort + recOrderSort + " S.Description LIMIT 100";

    } else {

    	if ($.sessionConst.NoStkEnbl || $.workflow.currentDoc=='Return') {
            var stockCondition = "";
        } else {
            var stockCondition = " AND SS.StockValue > 0 ";
    	}

    	query.Text = "SELECT INQ.*, SS.StockValue AS CommonStock FROM _Catalog_SKU_Stocks SS INDEXED BY IND_SKUSSTOCK " +
              "JOIN (SELECT DISTINCT S.Id, S.Description, PL.Price AS Price, " +
	            groupFields +
	            "CB.Description AS Brand " +
	            recOrderFields +
	            "FROM _Document_PriceList_Prices PL INDEXED BY IND_PLREFSKU " +
	            "JOIN _Catalog_SKU S " +
	            groupJoin +
	            "JOIN Catalog_Brands CB ON CB.Id=S.Brand " +
	            groupParentJoin +
	            recOrderStr + filterString +
	            " WHERE PL.Ref = @Ref AND PL.IsTombstone = 0 AND S.IsTombstone = 0 " + groupWhere + searchString +
	            ") INQ ON SS.Ref = INQ.Id WHERE SS.Stock=@stock AND SS.IsTombstone = 0 " + stockCondition + " ORDER BY " + groupSort + recOrderSort + " INQ.Description LIMIT 100";

    	query.AddParameter("stock", stock);

    }

    query.AddParameter("Ref", priceList);

    return query.Execute();

}

function GetQuickOrder(control, skuId, itemPrice, packField, editField, textViewField, recOrder, recUnitId, recUnit, index){
    if(swipedRow != control)
        HideSwiped();

    if(parseInt(control.Index)==parseInt(0)){
        var query = new Query();
        query.Text = "SELECT S.Id, S.Description, BF.Feature AS DefaultFeature, " +
                "SP.Pack AS DefaultUnit, IfNull(O.Qty, 0) AS Qty, U.Description AS Pack, SP.Multiplier AS Multiplier " +
                "FROM Catalog_SKU S " +
                "JOIN Catalog_SKU_Packing SP ON S.Id=SP.Ref " +
                "JOIN Catalog_UnitsOfMeasure U ON SP.Pack=U.Id " +
                "LEFT JOIN Catalog_SKU_Stocks BF ON BF.Ref=S.Id AND BF.LineNumber=1 " +
                "LEFT JOIN Document_" + $.workflow.currentDoc + "_SKUs O ON O.Ref=@order AND O.SKU = S.Id " +
                    "AND O.Feature=BF.Feature AND O.Units=SP.Pack " +
                "WHERE S.Id=@sku AND SP.Pack=@pack"
        query.AddParameter("order", ($.workflow.currentDoc == "Order" ? $.workflow.order : $.workflow.Return));
        query.AddParameter("sku", skuId);
        if (recUnit==null){
            var q = new Query("SELECT Pack FROM Catalog_SKU_Packing WHERE Ref=@ref AND LineNumber=1");
            q.AddParameter("ref", skuId);
            query.AddParameter("pack", q.ExecuteScalar());
        }
        else
            query.AddParameter("pack", recUnitId);
        var quickOrderItem =  query.Execute();

        defFeature = quickOrderItem.DefaultFeature;
        if (doRecommend && recUnit!=null){ //&& parseInt(quickOrderItem.Qty)==parseInt(0)) {
            defPack = recUnitId;
            packDescription = recUnit;
            defMultiplier = quickOrderItem.Multiplier;
            Variables[editField].Text = recOrder;

        } else {
            defPack = quickOrderItem.DefaultUnit;
            packDescription = quickOrderItem.Pack;
            defMultiplier = quickOrderItem.Multiplier;
        }

        Variables[packField].Text = packDescription;
        Variables[textViewField].Text = quickOrderItem.Qty + " " + packDescription + " " + alreadyOrdered;
        multiplier = quickOrderItem.Multiplier;

    }

    swipedRow = control;
}

function SelectSKU(sku, price, recOrder, unit, thisDoc){
    var args = new Dictionary();
    args.Add("SKU", sku);
    args.Add("basePrice", price);
    args.Add("recOrder", recOrder);
    args.Add("Units", unit);
    args.Add("Ref", thisDoc);

    OrderItem.InitItem(args);

    DoAction('SelectSKU');
}

function AddToOrder(control, editFieldName) {
    var editText = Converter.ToDecimal(0);
    if (String.IsNullOrEmpty(Variables[editFieldName].Text) == false)
        editText = Converter.ToDecimal(Variables[editFieldName].Text);
    Variables[editFieldName].Text = editText + parseInt(1);
}

function CreateOrderItem(control, editFieldName, textFieldName, packField, sku, price, swiped_rowName, recOrder, recUnitId) {

	if (swipedRow!=Variables[swiped_rowName])
		GetQuickOrder(Variables[swiped_rowName], sku, price, packField, editFieldName, textViewField, recOrder, recUnitId, recUnit);

    if (String.IsNullOrEmpty(Variables[editFieldName].Text) == false) {
        if (Converter.ToDecimal(Variables[editFieldName].Text) != Converter.ToDecimal(0)) {

            var p = DB.Create("Document." + $.workflow.currentDoc + "_SKUs");
            if ($.workflow.currentDoc=="Order")
                p.Ref = $.workflow.order;
            else
                p.Ref = $.workflow.Return;
            p.SKU = sku;
            p.Feature = defFeature;
            p.Price = price * defMultiplier;
            p.Qty = Converter.ToDecimal(Variables[editFieldName].Text);

            var d = GlobalWorkflow.GetMassDiscount(thisDoc);
            p.Discount = String.IsNullOrEmpty(d) ? 0 : d;

            p.Total = p.Price * (1 + p.Discount/100);
            p.Amount = p.Total * p.Qty;
            p.Units = defPack;            
            p.Save();

            Global.FindTwinAndUnite(p);

            var query = new Query("SELECT Qty FROM Document_" + $.workflow.currentDoc + "_SKUs WHERE Ref=@ref AND SKU=@sku AND Feature=@feature AND Units=@units");
            query.AddParameter("ref", p.Ref);
            query.AddParameter("sku", p.SKU);
            query.AddParameter("feature", p.Feature);
            query.AddParameter("units", p.Units);
            var qty = query.ExecuteScalar();

            Variables[editFieldName].Text = 0;
            Variables[textFieldName].Text = qty + " " + packDescription + " " + alreadyOrdered;
        }
    }
}

function EmptyStockAllowed() {
    var q = new Query("SELECT LogicValue FROM Catalog_MobileApplicationSettings WHERE Code='EmptyStockEnabled'");
    var res = q.ExecuteScalar();

    if (res == null)
        return false;
    else {
        if (parseInt(res) == parseInt(0))
            return false
        else
            return true;
    }
}

function GetGroupPath(group, parent, parentDescription) {
    var string = "";

    if (String.IsNullOrEmpty(parentDescription) == false)
        string = string + "/ " + parent.Description;
    return string;
}

function AddFilter(filterString, filterName, condition, tableName) {

	var q = new Query("SELECT F.Id FROM USR_Filters F INDEXED BY IND_FILTERS WHERE F.FilterType = @filterName");

	q.AddParameter("filterName", filterName);

	var res = q.ExecuteScalar();

	if (res!=null) {

    filterString += String.Format(" JOIN USR_Filters {0} INDEXED BY IND_FILTERS ON {0}.FilterType = '{1}' AND {0}.Id = {2} ", tableName, filterName, condition);

	}

	return filterString;

}

function OnScroll(sender) {

    if($.grScrollView.ScrollIndex > 0 && swipedRow != $.grScrollView.Controls[$.grScrollView.ScrollIndex])
        HideSwiped();

}

function HideSwiped() {

    if(swipedRow != null)
      swipedRow.Index = 1;

}

function DoGroupping() {

	var q = new Query("SELECT F.Id FROM USR_Filters F WHERE F.FilterType = @filterName");

	q.AddParameter("filterName", "group_filter");

	var res = q.ExecuteScalar();

	if (res != null) {
		return true;
    }
    return false;
}

function DoRecommend() {

    if ($.workflow.name=="Visit" && $.sessionConst.OrderCalc)
        return true;
    else
        return false;
}

function GoBackTo(){
    Workflow.BackTo($.workflow.currentDoc);
}

// --------------------------Filters------------------

function SetFilter() {
    if (Variables.Exists("filterType") == false)
        Variables.AddGlobal("filterType", "group");
    else
        return Variables["filterType"];
}

function AskAndBack() {

	del = new Query("DELETE FROM USR_Filters");

	del.Execute();

	Workflow.Refresh([$.screenContext]);

}

function CheckFilterAndForward() {

	 Workflow.Forward([null, true]);

}

function GetLeftFilterStyle(val) {
    if (Variables["filterType"] == val)
        return "mode_left_button_on";
    else
        return "mode_left_button_off";
}

function GetRightFilterStyle(val) {
    if (Variables["filterType"] == val)
        return "mode_right_button_on";
    else
        return "mode_right_button_off";
}

function ChangeFilterAndRefresh(type) {
    Variables.Remove("filterType");
    Variables.AddGlobal("filterType", type);
    Workflow.Refresh([$.screenContext]);

}

function GetGroups(priceList, stock, screenContext) {

  var filterString = " ";

  filterString = AddFilter(filterString, "brand_filter", "S.Brand", "BF");

  if (screenContext=="Order"){

    var q = new Query("SELECT DISTINCT SG.Id AS ChildId, USGF.Id AS ChildIsSet, SG.Description As Child, SGP.Id AS ParentId, SGP.Description AS Parent, USPF.Id AS ParentIsSet " +
        		"FROM _Document_PriceList_Prices SP INDEXED BY IND_PLREFSKU " +
        		"JOIN _Catalog_SKU S INDEXED BY IND_SKUOWNERBRAND ON SP.SKU = S.Id " + filterString +
        		"JOIN _Catalog_SKUGroup SG INDEXED BY IND_SKUGROUPPARENT ON S.Owner = SG.Id " +
        		"LEFT JOIN USR_Filters USGF ON USGF.Id = SG.Id " +
        		"LEFT JOIN Catalog_SKUGroup SGP ON SG.Parent = SGP.Id " +
        		"LEFT JOIN USR_Filters USPF ON USPF.Id = SGP.Id " +
        		"WHERE SP.Ref = @priceList AND SP.IsTombstone = 0 AND S.IsTombstone = 0 AND SG.IsTombstone = 0 " +
        		"AND CASE WHEN @isStockEmptyRef = 0 THEN SP.SKU IN(SELECT SS.Ref FROM _Catalog_SKU_Stocks SS INDEXED BY IND_SKUSSTOCK WHERE SS.IsTombstone = 0 AND SS.Stock = @stock AND CASE WHEN @NoStkEnbl = 1 THEN 1 ELSE SS.StockValue > 0 END ORDER BY SS.Ref, SS.Stock, SS.IsTombstone) ELSE CASE WHEN @NoStkEnbl = 1 THEN 1 ELSE S.CommonStock > 0 END END " +
        		"ORDER BY Parent, Child");

    q.AddParameter("priceList", priceList);
    q.AddParameter("stock", stock);

    isStockEmptyRef = stock.ToString() == DB.EmptyRef("Catalog_Stock").ToString() ? 1 : 0;

    q.AddParameter("isStockEmptyRef", isStockEmptyRef);
    q.AddParameter("NoStkEnbl", $.sessionConst.NoStkEnbl);

    return q.Execute();

  }

  if (screenContext=="Questionnaire"){

    var q1 = new Query("SELECT DISTINCT G.Id AS ChildId, G.Description AS Child, USGF.Id AS ChildIsSet, GP.Id AS ParentId, GP.Description AS Parent, USPF.Id AS ParentIsSet " +
        		"FROM _Catalog_SKU S INDEXED BY IND_SKUOWNERBRAND" + filterString +
        		"JOIN _Catalog_SKUGroup G INDEXED BY IND_SKUGROUPPARENT ON S.Owner = G.Id " +
        		"LEFT JOIN USR_Filters USGF ON USGF.Id = G.Id " +
        		"LEFT JOIN Catalog_SKUGroup GP ON G.Parent = GP.Id " +
        		"LEFT JOIN USR_Filters USPF ON USPF.Id = GP.Id " +
        		"WHERE S.IsTombstone = 0 AND G.IsTombstone = 0 AND S.Id IN (SELECT DISTINCT SKU FROM USR_SKUQuestions) ORDER BY Parent, Child");

    return q1.Execute();

  }
}

function ShowGroup(currentGroup, parentGroup) {
    if (currentGroup != parentGroup || parentGroup == null)
        return true;
    else
        return false;
}

function AssignHierarchy(rcs) {

	if (rcs.ParentId == null) {

    	$.Add("parentId", rcs.ChildId);
        $.Add("parent", rcs.Child);
        $.Add("childExists", false);

        if (rcs.ChildIsSet == null) {
        	$.Add("isSet", false);
		} else {
			$.Add("isSet", true);
		}

    } else {

    	$.Add("parentId", rcs.ParentId);
        $.Add("parent", rcs.Parent);
        $.Add("childExists", true);

        if (rcs.ParentIsSet == null) {
        	$.Add("isSet", false);
		} else {
			$.Add("isSet", true);
		}

    }

	return "dummy"

}

function AddFilterAndRefresh(item, filterName) {

	var q = new Query("SELECT F.Id FROM USR_Filters F WHERE F.Id = @item");

	q.AddParameter("item", item);

	var res = q.ExecuteScalar();

	var flagName = "";

	if (res == null) {

		ins = new Query("INSERT INTO USR_Filters (Id, FilterType) VALUES (@item, @filterName)");

		ins.AddParameter("item", item);
		ins.AddParameter("filterName", filterName);

		ins.Execute();

		flagName = "flag" + item.ToString();

		if (Variables.Exists(flagName)) {

			Variables[flagName].Visible = true;

		}

		if (item.IsFolder) {

			var chld = GetChildren(item);

			while (chld.Next()) {

				ins = new Query("INSERT INTO USR_Filters (Id, FilterType) VALUES (@item, @filterName)");

				ins.AddParameter("item", chld.Id);
				ins.AddParameter("filterName", filterName);

				ins.Execute();

				flagName = "flag" + chld.Id.ToString();

				if (Variables.Exists(flagName)) {

					Variables[flagName].Visible = true;

				}

			}

		}

	} else {

		del = new Query("DELETE FROM USR_Filters Where Id = @item");

		del.AddParameter("item", item);

		del.Execute();

		flagName = "flag" + item.ToString();

		if (Variables.Exists(flagName)) {

			Variables[flagName].Visible = false;

		}

		if (item.IsFolder) {

			var chld = GetChildren(item);

			while (chld.Next()) {

				del = new Query("DELETE FROM USR_Filters Where Id = @item");

				del.AddParameter("item", chld.Id);

				del.Execute();

				flagName = "flag" + chld.Id.ToString();

				if (Variables.Exists(flagName)) {

					Variables[flagName].Visible = false;

				}

			}

		}

	}

}

function GetChildren(parent) {
    var q = new Query("SELECT Id, Description FROM Catalog_SKUGroup WHERE Parent=@p1 ORDER BY Description");
    q.AddParameter("p1", parent);
    return q.Execute();
}

function GetBrands(priceList, stock, screenContext) {

  var filterString = " ";

	filterString = AddFilter(filterString, "group_filter", "S.Owner", "OF");

  if (screenContext=="Order"){

  	var q = new Query("SELECT DISTINCT SB.Id, SB.Description, USBF.Id AS BrandIsSet  " +
      		"FROM _Document_PriceList_Prices SP INDEXED BY IND_PLREFSKU " +
      		"JOIN _Catalog_SKU S INDEXED BY IND_SKUOWNERBRAND ON SP.SKU = S.Id " + filterString +
      		"JOIN Catalog_Brands SB ON S.Brand = SB.Id " +
      		"LEFT JOIN USR_Filters USBF ON USBF.Id = SB.Id " +
      		"WHERE SP.Ref = @priceList AND SP.IsTombstone = 0 AND S.IsTombstone = 0 " +
      		"AND CASE WHEN @isStockEmptyRef = 0 THEN SP.SKU IN(SELECT SS.Ref FROM _Catalog_SKU_Stocks SS INDEXED BY IND_SKUSSTOCK WHERE SS.IsTombstone = 0 AND SS.Stock = @stock AND CASE WHEN @NoStkEnbl = 1 THEN 1 ELSE SS.StockValue > 0 END ORDER BY SS.Ref, SS.Stock, SS.IsTombstone) ELSE CASE WHEN @NoStkEnbl = 1 THEN 1 ELSE S.CommonStock > 0 END END " +
      		"ORDER BY SB.Description");

  	q.AddParameter("priceList", priceList);
    q.AddParameter("stock", stock);

    isStockEmptyRef = stock.ToString() == DB.EmptyRef("Catalog_Stock").ToString() ? 1 : 0;

    q.AddParameter("isStockEmptyRef", isStockEmptyRef);
    q.AddParameter("NoStkEnbl", $.sessionConst.NoStkEnbl);

    return q.Execute();

  }

  if (screenContext=="Questionnaire"){

  	  var q1 = new Query("SELECT DISTINCT B.Id, B.Description, USBF.Id AS BrandIsSet " +
      		"FROM _Catalog_SKU S INDEXED BY IND_SKUOWNERBRAND " + filterString +
      		"JOIN Catalog_Brands B ON S.Brand=B.Id " +
      		"LEFT JOIN USR_Filters USBF ON USBF.Id = B.Id " +
      		"WHERE S.IsTombstone = 0 AND S.Id IN (SELECT DISTINCT SKU FROM USR_SKUQuestions) ORDER BY B.Description");

      return q1.Execute();

  }

}

function ShowDialog(control, val) {
    var d = parseInt(50);
    return d;
}

function CreateCondition(list, field) {
    var str = "";
    var notEmpty = false;

    for ( var quest in list) {
        if (String.IsNullOrEmpty(str)==false){
            str = str + ", ";
        }
        str = str + " '" + quest.ToString() + "' ";
        notEmpty = true;
    }
    if (notEmpty){
        str = field + " IN ( " + str  + ") ";
    }

    return str;
}
