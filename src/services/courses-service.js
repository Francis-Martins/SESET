// courses-service.js
// Shared Firestore data layer for courses, lectures, and sessions.
// Used by: courses.js, create-session.js, lecture-history.js

import { db } from "../config/firebase.js";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  setDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---- Courses ----

export async function getCourses() {
  const snapshot = await getDocs(collection(db, "courses"));
  return snapshot.docs.map((docSnap) => {
    const course = docSnap.data();
    return {
      id: docSnap.id,
      title: course.title,
      code: course.code || "—",
      createdAt: course.createdAt ? course.createdAt.toDate() : null
    };
  });
}

export async function isCourseCodeTaken(code) {
  const q = query(collection(db, "courses"), where("code", "==", code));
  const snapshot = await getDocs(q);
  return !snapshot.empty;
}

export async function createCourse(title, code) {
  return addDoc(collection(db, "courses"), {
    title: title,
    code: code,
    createdAt: serverTimestamp()
  });
}
// ---- Lecture Sessions ----

export async function startLectureSession({ courseId, courseTitle, courseCode, lectureTitle, date, startTime, endTime }) {
  const startDate = new Date(`${date}T${startTime}`);
  const endDate = new Date(`${date}T${endTime}`);

  const lectureRef = await addDoc(collection(db, "lectures"), {
    courseId,
    courseTitle,
    courseCode,
    title: lectureTitle,
    date,
    startTime: Timestamp.fromDate(startDate),
    endTime: Timestamp.fromDate(endDate),
    status: "active",
    createdAt: serverTimestamp()
  });

  await setDoc(doc(db, "systemStatus", "current"), {
    sessionActive: true,
    lectureId: lectureRef.id,
    courseId,
    lectureTitle,
    courseTitle,
    courseCode,
    sessionEndTime: Timestamp.fromDate(endDate)
  });

  return lectureRef.id;
}

// ---- Lecture History ----

export async function getLectureHistory() {
  const q = query(collection(db, "lectures"), orderBy("date", "desc"));
  const snapshot = await getDocs(q);
  const lectures = snapshot.docs.map((docSnap) => {
    const lecture = docSnap.data();
    return {
      id: docSnap.id,
      courseId: lecture.courseId,
      courseTitle: lecture.courseTitle,
      courseCode: lecture.courseCode || "—",
      title: lecture.title,
      date: lecture.date,
      startTime: lecture.startTime?.toDate() || null,
      endTime: lecture.endTime?.toDate() || null,
      status: lecture.status
    };
  });

  // Secondary sort by startTime, done client-side to avoid a composite index
  lectures.sort((a, b) => {
    if (a.date !== b.date) return 0; // already ordered by date from the query
    const aTime = a.startTime ? a.startTime.getTime() : 0;
    const bTime = b.startTime ? b.startTime.getTime() : 0;
    return bTime - aTime; // descending
  });

  return lectures;
}

// ---- Attendance (per lecture, for the printable sheet) ----

export async function getAttendanceForLecture(lectureId) {
  const q = query(collection(db, "attendanceLog"), where("lectureId", "==", lectureId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => {
    const record = docSnap.data();
    return {
      id: docSnap.id,
      name: record.name || "",
      regNumber: record.regNumber || "",
      time: record.time || "",
      mode: record.mode || ""
    };
  });
}


// ---- Students (for Reports) ----

export async function getStudents() {
  const snapshot = await getDocs(collection(db, "students"));
  return snapshot.docs.map((docSnap) => {
    const student = docSnap.data();
    return {
      id: docSnap.id,
      name: student.name || "",
      regNo: student.regNo || ""
    };
  });
}

// ---- Course Attendance Report ----

export async function getCourseAttendanceReport(courseId, regNo = null) {
  // Total completed sessions for this course
  const lecturesQ = query(
    collection(db, "lectures"),
    where("courseId", "==", courseId),
    where("status", "==", "completed")
  );
  const lecturesSnap = await getDocs(lecturesQ);
  const totalSessions = lecturesSnap.size;

  // Attendance records for this course, build regNo -> count map
  const attendanceQ = query(collection(db, "attendanceLog"), where("courseId", "==", courseId));
  const attendanceSnap = await getDocs(attendanceQ);
  const attendedCountMap = {};
  attendanceSnap.forEach((docSnap) => {
    const record = docSnap.data();
    const key = record.regNumber || "";
    if (!key) return;
    attendedCountMap[key] = (attendedCountMap[key] || 0) + 1;
  });

  function buildRow(name, studentRegNo) {
    const attended = attendedCountMap[studentRegNo] || 0;
    const percentage = totalSessions > 0 ? Math.round((attended / totalSessions) * 100) : 0;
    return { name, regNo: studentRegNo, attended, total: totalSessions, percentage };
  }

  if (regNo) {
    // Specific student — look up their name
    const students = await getStudents();
    const student = students.find((s) => s.regNo === regNo);
    const name = student ? student.name : "";
    return [buildRow(name, regNo)];
  }

  // All students
  const students = await getStudents();
  return students.map((s) => buildRow(s.name, s.regNo));
}