var defFeature;
var defPack;
var packDescription;
var swipedRow;
var rec_order;
var doRecommend;
var doGroupping;

function OnLoading() {
    rec_order = "<font size=''>1576 шт.</font>";
    doGroupping = DoGroupping();
    doRecommend = DoRecommend();
}

function WarMupFunction() {
	
}

function GetSKUAndGroups(searchText, priceList, stock) {

    var filterString = "";
    filterString += AddFilter(filterString, "group_filter", "G.Id", " AND ");
    filterString += AddFilter(filterString, "brand_filter", "CB.Id", " AND ");
    
    var groupFields = "";
    var groupJoin = "";
    var groupParentJoin = "";
    var groupSort = "";
    if (doGroupping){
        groupFields = " G.Description AS GroupDescription, G.Id AS GroupId, G.Parent AS GroupParent, P.Description AS ParentDescription, ";
        groupJoin = "JOIN Catalog_SKUGroup G ON G.Id = S.Owner ";
        groupParentJoin = "LEFT JOIN Catalog_SKUGroup P ON G.Parent=P.Id ";
        groupSort = " G.Description, ";
    }

    var query = new Query();
    
    var searchString = "";
    
    if (String.IsNullOrEmpty(searchText) == false) {
        searchString = " AND Contains(S.Description, '" + searchText + "') ";
    }
        
    var recOrderFields = ", 0 AS RecOrder, NULL AS UnitId, NULL AS RecUnit ";
    var recOrderStr = "";
    var recOrderSort = "";
    if (doRecommend){
        recOrderFields =     ", CASE WHEN V.Answer IS NULL THEN U.Description ELSE UB.Description END AS RecUnit " +
                            ", CASE WHEN V.Answer IS NULL THEN U.Id ELSE UB.Id END AS UnitId " +
                            ", CASE WHEN V.Answer IS NULL THEN MS.Qty ELSE (MS.BaseUnitQty-V.Answer) END AS RecOrder " +
                            ", CASE WHEN MS.Qty IS NULL THEN 0 ELSE CASE WHEN (MS.Qty-V.Answer)>0 OR (V.Answer IS NULL AND MS.Qty>0) THEN 2 ELSE 1 END END AS OrderRecOrder "
        recOrderStr =   "JOIN Catalog_UnitsOfMeasure UB ON S.BaseUnit=UB.Id " +
                        "LEFT JOIN Catalog_AssortmentMatrix_Outlets O ON O.Outlet=@outlet " +
                        "LEFT JOIN Catalog_AssortmentMatrix_SKUs MS ON S.Id=MS.SKU AND MS.BaseUnitQty IN " +
                                " (SELECT MAX(SS.BaseUnitQty) FROM Catalog_AssortmentMatrix_SKUs SS " +
                                " JOIN Catalog_AssortmentMatrix_Outlets OO ON SS.Ref=OO.Ref    " +
                                " WHERE Outlet=@outlet AND SS.SKU=MS.SKU LIMIT 1) " +
                            "LEFT JOIN Catalog_UnitsOfMeasure U ON MS.Unit=U.Id " +
                            "LEFT JOIN Document_Visit_SKUs V ON MS.SKU=V.SKU AND V.Ref=@visit AND V.Question IN (SELECT Id FROM Catalog_Question CQ WHERE CQ.Assignment=@assignment)";
        query.AddParameter("outlet", $.workflow.outlet);
        query.AddParameter("visit", $.workflow.visit);
        query.AddParameter("assignment", DB.Current.Constant.SKUQuestions.Stock);
        recOrderSort = " OrderRecOrder DESC, ";
    }
    
    if ($.workflow.order.Stock.EmptyRef()==true){
    
    	if ($.sessionConst.NoStkEnbl) {
            var stockCondition = "";
        } else {
            var stockCondition = " S.CommonStock > 0 AND ";
    	}
    	
	    query.Text = "SELECT DISTINCT S.Id, S.Description, PL.Price, S.CommonStock AS CommonStock, " +
	            groupFields +
	            "CB.Description AS Brand " +
	            recOrderFields +
	            "FROM Document_PriceList_Prices PL " +
	            "JOIN Catalog_SKU S ON PL.SKU = S.Id " +            
	            groupJoin +                        
	            "JOIN Catalog_Brands CB ON CB.Id=S.Brand " +            
	            groupParentJoin +
	            recOrderStr +
	            " WHERE " + stockCondition + " PL.Ref = @Ref " + searchString + filterString +
	            " ORDER BY " + groupSort + recOrderSort + " S.Description LIMIT 100";
    
    } else {
    	
    	if ($.sessionConst.NoStkEnbl) {
            var stockCondition = "";
        } else {
            var stockCondition = " SS.StockValue > 0 AND ";
    	}
    	
    	query.Text = "SELECT INQ.*, SS.StockValue AS CommonStock FROM Catalog_SKU_Stocks SS JOIN (SELECT DISTINCT S.Id, S.Description, PL.Price, " +
	            groupFields +
	            "CB.Description AS Brand " +
	            recOrderFields +
	            "FROM Document_PriceList_Prices PL " +
	            "JOIN Catalog_SKU S ON PL.SKU = S.Id " +            
	            groupJoin +                        
	            "JOIN Catalog_Brands CB ON CB.Id=S.Brand " +            
	            groupParentJoin +
	            recOrderStr +
	            " WHERE PL.Ref = @Ref " + searchString + filterString +
	            " ORDER BY " + groupSort + recOrderSort + " S.Description) INQ ON SS.Ref = INQ.Id WHERE " + stockCondition + " SS.Stock=@stock LIMIT 100";
    	
    	query.AddParameter("stock", stock);
    	    	
    }
	    
    query.AddParameter("Ref", priceList);    
    
    return query.Execute();

}

function GetQuickOrder(control, skuId, itemPrice, packField, editField, textViewField, recOrder, recUnitId, recUnit){
    if(swipedRow != control)
        HideSwiped();
    
    if(parseInt(control.Index)==parseInt(0)){
        var query = new Query();
        query.Text = "SELECT S.Id, S.Description, BF.Feature AS DefaultFeature, " +
                "SP.Pack AS DefaultUnit, IfNull(O.Qty, 0) AS Qty, U.Description AS Pack, SP.Multiplier AS Multiplier " +
                "FROM Catalog_SKU S " +
                "JOIN Catalog_SKU_Packing SP ON S.Id=SP.Ref " +
                "JOIN Catalog_SKU_Stocks BF ON BF.Ref=S.Id AND BF.LineNumber=1 " +
                "JOIN Catalog_UnitsOfMeasure U ON SP.Pack=U.Id " +
                "LEFT JOIN Document_Order_SKUs O ON O.Ref=@order AND O.SKU = S.Id " +
                    "AND O.Feature=BF.Feature AND O.Units=SP.Pack " +
                "WHERE S.Id=@sku AND SP.Pack=@pack"
        query.AddParameter("order", $.workflow.order);
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
            Variables[editField].Text = recOrder;
            
        } else {
            defPack = quickOrderItem.DefaultUnit;
            packDescription = quickOrderItem.Pack;
        }                                
            
        Variables[packField].Text = packDescription;
        Variables[textViewField].Text = quickOrderItem.Qty + " " + packDescription + " " + Translate["#alreadyOrdered#"];
        multiplier = quickOrderItem.Multiplier;
    }
    
    swipedRow = control;
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

            var p = DB.Create("Document.Order_SKUs");
            p.Ref = $.workflow.order;
            p.SKU = sku;
            p.Feature = defFeature;
            p.Price = price;
            p.Qty = Converter.ToDecimal(Variables[editFieldName].Text);
            p.Total = p.Price * multiplier;
            p.Amount = p.Total * p.Qty;
            p.Units = defPack;
            p.Discount = 0;
            p.Save();

            FindTwinAndUnite(p);

            var query = new Query("SELECT Qty FROM Document_Order_SKUs WHERE Ref=@ref AND SKU=@sku AND Feature=@feature AND Units=@units");
            query.AddParameter("ref", p.Ref);
            query.AddParameter("sku", p.SKU);
            query.AddParameter("feature", p.Feature);
            query.AddParameter("units", p.Units);
            var qty = query.ExecuteScalar();

            Variables[editFieldName].Text = 0;
            Variables[textFieldName].Text = qty + " " + packDescription + " " + Translate["#alreadyOrdered#"];
        }
    }
}

function EmptyStockAllowed() {
    var q = new Query("SELECT Use FROM Catalog_MobileApplicationSettings WHERE Code='NoStkEnbl'");
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

function AddFilter(filterString, filterName, condition, connector) {
    
	var q = new Query("SELECT F.Id FROM USR_Filters F WHERE F.FilterType = @filterName");
	
	q.AddParameter("filterName", filterName);
	
	var res = q.ExecuteScalar();
	
	if (res!=null) {
		
		filterString += connector + condition + " IN(SELECT F.Id FROM USR_Filters F WHERE F.FilterType = '" + filterName + "') ";
		
	}
		
	return filterString;
	
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

function ShowRecommendedQty(order, recOrder) {
    if (order>0)
        if (recOrder>0)
            return true;
    return false;
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
    
    filterString += AddFilter(filterString, "brand_filter", "S.Brand", " AND ");
    
    if (screenContext=="Order"){
        
    	var q = new Query("SELECT DISTINCT SG.Id AS ChildId, USGF.Id AS ChildIsSet, SG.Description As Child, SGP.Id AS ParentId, SGP.Description AS Parent, USPF.Id AS ParentIsSet " +
        		"FROM Document_PriceList_Prices SP " +
        		"JOIN Catalog_SKU S On SP.SKU = S.Id " +
        		"JOIN Catalog_SKUGroup SG ON S.Owner = SG.Id " +
        		"LEFT JOIN USR_Filters USGF ON USGF.Id = SG.Id " +
        		"LEFT JOIN Catalog_SKUGroup SGP ON SG.Parent = SGP.Id " +
        		"LEFT JOIN USR_Filters USPF ON USPF.Id = SGP.Id " +
        		"WHERE SP.Ref = @priceList " +
        		"AND CASE WHEN @isStockEmptyRef = 0 THEN SP.SKU IN(SELECT SS.Ref FROM Catalog_SKU_Stocks SS WHERE SS.Stock = @stock AND CASE WHEN @NoStkEnbl = 1 THEN 1 ELSE SS.StockValue > 0 END) ELSE CASE WHEN @NoStkEnbl = 1 THEN 1 ELSE S.CommonStock > 0 END END " +
        		filterString + " ORDER BY Parent, Child");
        
    	q.AddParameter("priceList", priceList);
        q.AddParameter("stock", stock);
        
        isStockEmptyRef = stock.ToString() == DB.EmptyRef("Catalog_Stock").ToString() ? 1 : 0;
        
        q.AddParameter("isStockEmptyRef", isStockEmptyRef);
        q.AddParameter("NoStkEnbl", $.sessionConst.NoStkEnbl);
        
        return q.Execute();
    	    
    }
    
    if (screenContext=="Questionnaire"){
    
    	var str = CreateCondition($.workflow.questionnaires, " Ref ");
        var q1 = new Query("SELECT DISTINCT G.Id AS ChildId, G.Description AS Child, USGF.Id AS ChildIsSet, GP.Id AS ParentId, GP.Description AS Parent, USPF.Id AS ParentIsSet " +
        		"FROM Catalog_SKU S " +
        		"JOIN Catalog_SKUGroup G ON S.Owner = G.Id " +
        		"LEFT JOIN USR_Filters USGF ON USGF.Id = G.Id " +
        		"LEFT JOIN Catalog_SKUGroup GP ON G.Parent = GP.Id " +
        		"LEFT JOIN USR_Filters USPF ON USPF.Id = GP.Id " +
        		"WHERE S.ID IN (SELECT SKU FROM Document_Questionnaire_SKUs WHERE " + str + ") " + filterString + " ORDER BY Parent, Child");
    
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
    
	filterString += AddFilter(filterString, "group_filter", "S.Owner", " AND ");
    
    if (screenContext=="Order"){
        
    	var q = new Query("SELECT DISTINCT SB.Id, SB.Description, USBF.Id AS BrandIsSet  " +
        		"FROM Document_PriceList_Prices SP " +
        		"JOIN Catalog_SKU S ON SP.SKU = S.Id " +
        		"JOIN Catalog_Brands SB ON S.Brand = SB.Id " +
        		"LEFT JOIN USR_Filters USBF ON USBF.Id = SB.Id " +
        		"WHERE SP.Ref = @priceList " +
        		"AND CASE WHEN @isStockEmptyRef = 0 THEN SP.SKU IN(SELECT SS.Ref FROM Catalog_SKU_Stocks SS WHERE SS.Stock = @stock AND CASE WHEN @NoStkEnbl = 1 THEN 1 ELSE SS.StockValue > 0 END) ELSE CASE WHEN @NoStkEnbl = 1 THEN 1 ELSE S.CommonStock > 0 END END " +
        		filterString + " ORDER BY SB.Description");
        
    	q.AddParameter("priceList", priceList);
        q.AddParameter("stock", stock);
        
        isStockEmptyRef = stock.ToString() == DB.EmptyRef("Catalog_Stock").ToString() ? 1 : 0;
        
        q.AddParameter("isStockEmptyRef", isStockEmptyRef);        
        q.AddParameter("NoStkEnbl", $.sessionConst.NoStkEnbl);
        
        return q.Execute();
    	    	    	
    }
    
    if (screenContext=="Questionnaire"){
    
    	var str = CreateCondition($.workflow.questionnaires, " Ref ");
        var q1 = new Query("SELECT DISTINCT B.Id, B.Description, USBF.Id AS BrandIsSet " +
        		"FROM Catalog_SKU S " + 
        		"JOIN Catalog_Brands B ON S.Brand=B.Id " +
        		"JOIN Catalog_SKUGroup G ON S.Owner=G.Id " +
        		"LEFT JOIN USR_Filters USBF ON USBF.Id = B.Id " + 
        		"WHERE S.ID IN (SELECT SKU FROM Document_Questionnaire_SKUs WHERE " + str + ") " + filterString + " ORDER BY B.Description");
    
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

function FindTwinAndUnite(orderitem) { // DELETE AFTER WARMUP FIXED
	var q = new Query(
			"SELECT Id FROM Document_Order_SKUs WHERE Ref=@ref AND SKU=@sku AND Discount=@discount AND Units=@units AND Feature=@feature AND Id<>@id LIMIT 1"); // AND
																																								// Id<>@id
	q.AddParameter("ref", orderitem.Ref);
	q.AddParameter("sku", orderitem.SKU);
	q.AddParameter("discount", orderitem.Discount);
	q.AddParameter("units", orderitem.Units);
	q.AddParameter("feature", orderitem.Feature);
	q.AddParameter("id", orderitem.Id);
	var rst = q.ExecuteCount();
	if (parseInt(rst) != parseInt(0)) {
		var twin = q.ExecuteScalar();
		twin = twin.GetObject();
		twin.Qty += orderitem.Qty;
		twin.Save();
		DB.Delete(orderitem.Id);
	} else
		orderitem.Save();
}