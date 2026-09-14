-- İşletme takvimden kayıtsız müşteri (ad + telefon) ile randevu ekleyebilsin
-- customer_id artık zorunlu değil; bilgi custom_fields içinde tutulur

ALTER TABLE appointments
ALTER COLUMN customer_id DROP NOT NULL;
