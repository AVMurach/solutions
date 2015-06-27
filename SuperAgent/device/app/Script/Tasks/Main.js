function GetExecutedTasks(visit) {
	var query = new Query("SELECT VT.Id, DT.PlanDate, DT.TextTask, DT.Target FROM Document_Visit_Task VT JOIN Document_Task DT ON VT.TaskRef=DT.Id WHERE VT.Ref=@ref AND VT.Result=@result ORDER BY DT.PlanDate");
	query.AddParameter("ref", visit);
	query.AddParameter("result", true);

	return query.Execute();
}

function GetNotExecutedTasks(visit) {
	var q = new Query("SELECT DT.Id, DT.PlanDate, DT.TextTask, DT.Target FROM Document_Task DT LEFT JOIN Document_Visit_Task VT ON DT.Id = VT.TaskRef AND VT.Ref = @ref AND VT.Result=@result WHERE DT.PlanDate >= @planDate AND DT.Outlet = @outlet AND VT.Id IS NULL ORDER BY DT.PlanDate");
	q.AddParameter("planDate", DateTime.Now.Date);
	q.AddParameter("outlet", visit.Outlet);
	q.AddParameter("ref", visit);
	q.AddParameter("result", true);
	return q.Execute();
}

function CompleteTheTask(task, visit) {
	var visit_task = CreateVisitTaskValueIfNotExists(visit, task);
	var visit_task_obj = visit_task.GetObject();
	visit_task_obj.Result = true;
	visit_task_obj.Save();

	if (Variables.Exists("task"))
		Workflow.Refresh([ $.task, visit_task_obj.Id ]);
	else
		Workflow.Refresh([]);
}

function CreateVisitTaskValueIfNotExists(visit, task) {
	var query = new Query("SELECT Id from Document_Visit_Task WHERE Ref == @Visit AND TextTask == @Text");
	query.AddParameter("Visit", visit);
	query.AddParameter("Text", task.TextTask);
	var taskValue = query.ExecuteScalar();
	if (taskValue == null) {
		taskValue = DB.Create("Document.Visit_Task");
		taskValue.Ref = visit;
		taskValue.TextTask = task.TextTask;
		taskValue.TaskRef = task;
		taskValue.Save();
		taskValue = taskValue.Id;
	}

	return taskValue;
}

function RetrieveTask(executedTask) {
	var task_obj = executedTask.GetObject();
	task_obj.Result = false;
	task_obj.Save();

	if (Variables.Exists("task"))
		Workflow.Refresh([ $.task ]);
	else
		Workflow.Refresh([]);
}

function FormatDate(datetime) {
	return Format("{0:g}", Date(datetime).Date);
}

function GetTargetText(text) {
	if (String.IsNullOrEmpty(text))
		return Translate["#noDescriGiven#"];
	else
		return text;
}
