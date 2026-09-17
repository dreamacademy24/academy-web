'use client';
import MedicationReceipts from '@/components/MedicationReceipts';
export default function Page(){return <main style={{maxWidth:1200,margin:'24px auto',padding:16}}><a href="/admin/checkin-details">← 체크인 준비</a><h1 style={{margin:'16px 0'}}>상비약 전달·수령 관리</h1><MedicationReceipts/></main>;}
