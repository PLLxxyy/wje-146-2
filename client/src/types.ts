export interface User {
  id: number;
  username: string;
  nickname: string;
  avatar: string;
  phone: string;
  bio: string;
  created_at: string;
}

export interface Pet {
  id: number;
  user_id: number;
  name: string;
  breed: string;
  species: string;
  age: string;
  photo: string;
  vaccine: string;
  notes: string;
  created_at: string;
  owner_name?: string;
  owner_avatar?: string;
}

export interface FosteringNeed {
  id: number;
  user_id: number;
  pet_id: number;
  start_date: string;
  end_date: string;
  requirements: string;
  status: string;
  created_at: string;
  pet_name?: string;
  pet_breed?: string;
  pet_photo?: string;
  pet_species?: string;
  user_nickname?: string;
}

export interface FosteringApplication {
  id: number;
  fostering_need_id: number;
  applicant_id: number;
  experience: string;
  environment: string;
  status: string;
  created_at: string;
  applicant_nickname?: string;
  applicant_avatar?: string;
  pet_name?: string;
  pet_breed?: string;
  pet_photo?: string;
  start_date?: string;
  end_date?: string;
  requirements?: string;
  need_status?: string;
  owner_nickname?: string;
}

export interface Message {
  id: number;
  from_user_id: number;
  to_user_id: number;
  fostering_need_id: number;
  content: string;
  read: number;
  created_at: string;
  from_nickname?: string;
  from_avatar?: string;
}

export interface Conversation {
  other_user_id: number;
  fostering_need_id: number;
  start_date: string;
  end_date: string;
  pet_name: string;
  last_message: string;
  last_time: string;
  unread_count: number;
  other_nickname: string;
  other_avatar: string;
}

export interface Review {
  id: number;
  fostering_need_id: number;
  reviewer_id: number;
  reviewee_id: number;
  rating: number;
  comment: string;
  created_at: string;
  reviewer_nickname?: string;
  reviewee_nickname?: string;
}

export interface LostPet {
  id: number;
  user_id: number;
  photo: string;
  species: string;
  breed: string;
  name: string;
  lost_location: string;
  lost_date: string;
  contact: string;
  description: string;
  found: number;
  created_at: string;
  user_nickname?: string;
  user_phone?: string;
}
