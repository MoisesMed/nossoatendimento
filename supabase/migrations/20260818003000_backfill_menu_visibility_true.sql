update public.menu_items
set visible_in_menu = true
where visible_in_menu is false;

update public.menu_categories
set visible_in_menu = true
where visible_in_menu is false;
