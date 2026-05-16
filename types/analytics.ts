export type AnalyticsEventName =
  | 'app_open'
  | 'screen_view'
  | 'auth_sign_in_requested'
  | 'auth_sign_in_success'
  | 'auth_sign_in_failed'
  | 'auth_sign_up_requested'
  | 'auth_sign_up_success'
  | 'auth_sign_up_failed'
  | 'auth_password_reset_requested'
  | 'auth_verification_email_requested'
  | 'auth_sign_out_requested'
  | 'crew_create_started'
  | 'crew_create_success'
  | 'crew_create_failed'
  | 'crew_settings_updated'
  | 'crew_member_removed'
  | 'crew_member_role_changed'
  | 'crew_join_request_resolved'
  | 'crew_join_by_code_requested'
  | 'crew_join_by_code_success'
  | 'crew_join_by_code_failed'
  | 'crew_join_request_sent'
  | 'crew_leave_requested'
  | 'crew_leave_success'
  | 'crew_leave_failed'
  | 'crew_delete_requested'
  | 'crew_delete_success'
  | 'crew_delete_failed'
  | 'ride_create_success'
  | 'ride_update_success'
  | 'ride_delete_success'
  | 'ride_join'
  | 'ride_leave'
  | 'ride_check_in'
  | 'announcement_create_success'
  | 'announcement_update_success'
  | 'announcement_delete_success'
  | 'announcement_like'
  | 'announcement_unlike'
  | 'paywall_view'
  | 'purchase_intent'
  | 'purchase_success'
  | 'purchase_failed'
  | 'restore_intent'
  | 'restore_success'
  | 'restore_failed'
  | 'subscription_manage_requested';

export type AnalyticsProperties = Record<
  string,
  string | number | boolean | null | undefined
>;

export interface AnalyticsEventInput {
  eventName: AnalyticsEventName;
  actorUserId?: string | null;
  crewId?: string | null;
  route?: string | null;
  properties?: AnalyticsProperties;
}

export interface AnalyticsEventRecord extends AnalyticsEventInput {
  id: string;
  sessionId: string;
  installationId: string;
  platform: 'ios' | 'android' | 'web';
  appVersion: string | null;
  buildNumber: string | null;
  clientTimestamp: string;
}
