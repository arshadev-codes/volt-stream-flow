import { useEffect, useState, useCallback } from "react";
import {
  listObjects, listReports, subscribe,
  createObject, deleteObject, saveReport, getReport, getObject, updateObjectStatus, fetchReport,
} from "@/services/testObjectStore";
import type { TestObject, TestReport } from "@/types/testObject";

export function useTestObjects() {
  const [objects, setObjects] = useState<TestObject[]>([]);
  const [reports, setReports] = useState<TestReport[]>([]);

  const refresh = useCallback(() => {
    setObjects(listObjects());
    setReports(listReports());
  }, []);

  useEffect(() => {
    refresh();
    return subscribe(refresh);
  }, [refresh]);

  return {
    objects, reports, refresh,
    create: createObject,
    remove: deleteObject,
    saveReport,
    getReport,
    fetchReport,
    getObject,
    updateStatus: updateObjectStatus,
  };
}
