-- Create storage bucket for meal item images
INSERT INTO storage.buckets (id, name, public)
VALUES ('meal-item-images', 'meal-item-images', true);

-- Allow users to upload their own meal item images
CREATE POLICY "Users can upload their own meal item images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'meal-item-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to view their own meal item images
CREATE POLICY "Users can view their own meal item images"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'meal-item-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to update their own meal item images
CREATE POLICY "Users can update their own meal item images"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'meal-item-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own meal item images
CREATE POLICY "Users can delete their own meal item images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'meal-item-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);