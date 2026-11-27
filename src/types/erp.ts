export type UserRole = 'admin' | 'hod' | 'faculty' | 'student' | 'exam_controller';
export type AccountStatus = 'pending' | 'approved' | 'rejected' | 'disabled';
export type AttendanceStatus = 'present' | 'absent' | 'late';
export type AssignmentState = 'draft' | 'published' | 'closed' | 'archived';
export type SubmissionStatus =
  | 'not_submitted'
  | 'submitted'
  | 'late'
  | 'under_evaluation'
  | 'evaluated'
  | 'resubmission_requested';
export type EvaluationStatus = 'not_evaluated' | 'draft' | 'evaluated' | 'published';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  mobile: string | null;
  role: UserRole;
  status: AccountStatus;
  department_id: string | null;
  gender?: string | null;
  dob?: string | null;
  address?: string | null;
  bio?: string | null;
  avatar_icon?: string | null;
  specialization_id?: string | null;
  guardian_name?: string | null;
  guardian_phone?: string | null;
  blood_group?: string | null;
  custom_role_id?: string | null;
  mail_visibility?: 'public' | 'private';
  photo_drive_url?: string | null;
}

export interface SubmissionReviewItem {
  submission_id: string;
  assignment_id: string;
  assignment_title: string;
  class_label: string;
  department_name?: string;
  program_name?: string;
  semester_label?: string;
  subject_name: string;
  max_marks: number;
  due_at: string;
  student_id: string;
  student_name: string;
  roll_no: string;
  submitted_at: string;
  is_late: boolean;
  status: SubmissionStatus;
  version_no: number;
  drive_file_id: string;
  file_name: string;
  marks_obtained: number | null;
  feedback: string;
  evaluation_status: EvaluationStatus;
  evaluated_at?: string | null;
}

export interface AttendanceSummaryRow {
  teaching_assignment_id: string;
  subject_code: string;
  subject_name: string;
  conducted_sessions: number;
  cancelled_sessions: number;
  present_count: number;
  late_count: number;
  absent_count: number;
  attendance_pct: number;
}
