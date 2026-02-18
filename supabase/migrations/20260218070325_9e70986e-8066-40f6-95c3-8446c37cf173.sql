
-- Allow users to delete their own virtual cards
CREATE POLICY "Users can delete own cards"
ON public.virtual_cards
FOR DELETE
USING (auth.uid() = user_id);
