export const SELF_FIELDS=[
 ['first_name','First name'],['last_name','Last name'],['middle_name','Middle name'],['date_of_birth','Date of birth'],['gender','Gender'],['civil_status','Civil status'],['nationality','Nationality'],['contact_number','Phone number'],['personal_email','Personal email'],['current_address','Current address'],['permanent_address','Permanent address'],['emergency_contact_name','Emergency contact'],['emergency_relationship','Relationship'],['emergency_contact_number','Emergency phone'],['bank_name','Bank name'],['bank_account','Bank account number'],['sss_no','SSS number'],['philhealth_no','PhilHealth number'],['pagibig_no','Pag-IBIG number'],['tin','TIN']
] as const
export const SELF_EDITABLE=SELF_FIELDS.map(([key])=>key)
export const SELF_MISSING=['date_of_birth','contact_number','personal_email','current_address','emergency_contact_name','emergency_contact_number','bank_name','bank_account','sss_no','philhealth_no','pagibig_no','tin'] as const
export const SELF_READONLY=['employee_id','company','position','department','employment_status','date_hired','salary_type','basic_salary','allow_position','allow_transpo','allow_tutorial','allow_load','time_in','time_out','payroll_values','updated_at'] as const

