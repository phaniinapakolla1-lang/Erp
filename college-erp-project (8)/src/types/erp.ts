export type UserRole = 'admin' | 'hod' | 'faculty' | 'student';
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
}

export interface TeachingAssignment {
  id: string;
  class_name: string;
  section_code: string;
  program_name: string;
  semester_label: string;
  subject_code: string;
  subject_name: string;
  student_count: number;
}

export interface SubmissionReviewItem {
  submission_id: string;
  assignment_id: string;
  assignment_title: string;
  class_label: string;
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
}
