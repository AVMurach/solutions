function PlanVisitsKPI(){
	var q = new Query("SELECT COUNT(VP.Outlet) " +
		" FROM Document_Visit V " +
		" JOIN Document_VisitPlan_Outlets VP ON VP.Outlet=V.Outlet AND DATE(V.Date)=DATE(VP.Date) " +
		" JOIN Document_VisitPlan DV ON VP.Ref = DV.Id " +
		" WHERE DATE(V.Date) >= DATE('now', 'start of month', 'localtime') AND V.Plan <> @emptyRef ");
	q.AddParameter("emptyRef", DB.EmptyRef("Document_VisitPlan"));
	var executed = q.ExecuteScalar();		

	var q = new Query("SELECT COUNT(VPO.Outlet) " +
		" FROM Document_VisitPlan_Outlets VPO " +
		" JOIN Document_VisitPlan DP ON VPO.Ref = DP.Id " +
		" JOIN Catalog_Outlet O ON VPO.Outlet=O.Id " +
		" JOIN Catalog_OutletsStatusesSettings OSS ON O.OutletStatus=OSS.Status AND OSS.ShowOutletInMA=1 AND OSS.DoVisitInMA=1 " +
		" WHERE DATE(VPO.Date)>=DATE('now', 'start of month', 'localtime') AND DATE(VPO.Date)<=DATE('now', 'localtime') AND NOT OSS.Status IS NULL");
	var planned = q.ExecuteScalar();

	return parseFloat(planned)==parseFloat(0) ? "0" : String.Format("{0:F0}", (executed * 100 / planned) || 0);
}