with target_tenant as (
  select id as tenant_id
  from public.tenants
  where slug = 'manja'
), category_source(name, sort_order) as (
  values
    ('COMBOS', 0),
    ('JANTINHAS', 1),
    ('GUARNIÇÕES', 2),
    ('CHURRASCOS', 3),
    ('PORÇÕES', 4),
    ('CALDOS & SOPAS', 5),
    ('BEBIDAS', 6),
    ('SUCOS NATURAIS', 7),
    ('AÇAÍ E GELATOS', 8),
    ('CERVEJAS', 10)
)
insert into public.menu_categories (tenant_id, name, sort_order, active)
select tt.tenant_id, cs.name, cs.sort_order, true
from target_tenant tt
cross join category_source cs
on conflict (tenant_id, name)
do update
set
  sort_order = excluded.sort_order,
  active = true;

with target_tenant as (
  select id as tenant_id
  from public.tenants
  where slug = 'manja'
), item_source(name, description, price, category) as (
  values
    ('Combo Casal', 'Acompanha 3 Espetos tradicional , 1 porção de batata, 1 baião G e 1 refrigerante lata', 75.99, 'COMBOS'),
    ('Combo Família', 'Acompanha 3 Espetos tradicional 2 espeto especiais  , 1 porção de batata e 1 refrigerante 1L', 99.99, 'COMBOS'),
    ('Jantinha Completa', 'Acompanha baião ou arroz, churrasca, batata, farofa e batata', 25.00, 'JANTINHAS'),
    ('Combo Jantinha', 'Acompanha baião ou arroz, churrasco tradicional ,batata, farofa e batata + Refrigerante 200 ml', 28.99, 'JANTINHAS'),
    ('Pratinho tradicional', 'Acompanha creme de frango, arroz, farofa e batata palha', 16.99, 'JANTINHAS'),
    ('Pratinho especial', '', 19.99, 'JANTINHAS'),
    ('Porção de Baião Simples', 'Deliciosa porção de baião de dois, com arroz, feijão-de-corda, queijo coalho e carne de sol. Simplesmente surpreendente!', 15.00, 'GUARNIÇÕES'),
    ('Porção de Baião Nordestino', 'Deliciosa porção de baião nordestino com carne do sol, queijo, e cheiro verde, perfeita para compartilhar entre amigos.', 19.99, 'GUARNIÇÕES'),
    ('Porção de Arroz', 'Arroz soltinho e saboroso, acompanhamento perfeito para seus pratos favoritos.', 12.00, 'GUARNIÇÕES'),
    ('Porção de Arroz c/ Camarão', 'Delicioso arroz de camarão, com sabor único e camarões suculentos, uma combinação perfeita para os amantes de frutos do mar.', 18.99, 'GUARNIÇÕES'),
    ('Porção de Arroz Nordestino G', '', 31.99, 'GUARNIÇÕES'),
    ('Churrasco Simples', 'Escolha sua Carne!', 10.00, 'CHURRASCOS'),
    ('Churrasco Especial', 'Escolha sua Carne!', 12.00, 'CHURRASCOS'),
    ('Espetinho Delicia ( Romeu e Julieta )', '', 15.00, 'CHURRASCOS'),
    ('Porção de Calabresa c/ Fritas', 'Deliciosa porção de calabresa artesanal acompanhada de fritas crocantes, perfeita para compartilhar com os amigos.', 34.99, 'PORÇÕES'),
    ('Porção de Batata Frita Simples', 'Deliciosa porção de batata frita crocante, perfeita para compartilhar com os amigos.', 18.00, 'PORÇÕES'),
    ('Porção de Batata Frita Especial', 'Deliciosa porção de batata frita crocante coberta com queijo cheddar derretido e pedacinhos saborosos de bacon.', 24.99, 'PORÇÕES'),
    ('Kit com 3 Caranguejios', '', 32.99, 'PORÇÕES'),
    ('Bolinha de Carne do Sol / Queijo com 12 und', '', 23.99, 'PORÇÕES'),
    ('Pastelzinho Carne do Sol /Queijo  com 12 und', '', 23.99, 'PORÇÕES'),
    ('Feijão Verde Nordestino', 'Feijão verde do Nordeste com carne de sol, queijo, cheiro verde e ovo de codorna. Uma delícia tradicional e saborosa!', 29.99, 'CALDOS & SOPAS'),
    ('Sopa de Carne c/ Ovos', 'Deliciosa sopa de carne com ovos, um prato reconfortante e cheio de sabor para aquecer o seu dia.', 12.99, 'CALDOS & SOPAS'),
    ('Canja de Frango', 'Sopa reconfortante feita com frango, arroz e legumes frescos, perfeita para aquecer corpo e alma.', 12.99, 'CALDOS & SOPAS'),
    ('Sopa de Macaxeira c/ Frango, Calabresa e Bacon', 'Saborosa combinação de macaxeira cremosa, frango desfiado, calabresa e bacon crocante em uma deliciosa sopa caseira.', 12.99, 'CALDOS & SOPAS'),
    ('Coca Cola Lata', 'Lata 350 mL', 7.00, 'BEBIDAS'),
    ('Coca Cola Zero Lata', 'Lata 350 mL', 7.00, 'BEBIDAS'),
    ('Fanta Uva Lata', 'Lata 350 mL', 7.00, 'BEBIDAS'),
    ('Fanta Laranja Lata', 'Lata 350 mL', 7.00, 'BEBIDAS'),
    ('Fanta Guaraná Lata', 'Lata 350 mL', 7.00, 'BEBIDAS'),
    ('Coca Cola 600 mL', 'Garrafa 600 mL', 9.99, 'BEBIDAS'),
    ('Coca Cola 1L', 'Garrafa 1L', 12.99, 'BEBIDAS'),
    ('Água sem gás', '', 4.00, 'BEBIDAS'),
    ('Água com gás', '', 4.50, 'BEBIDAS'),
    ('Suco de Acerola', 'Copo 300 mL', 7.00, 'SUCOS NATURAIS'),
    ('Suco de Cajá', 'Copo 300 mL', 7.00, 'SUCOS NATURAIS'),
    ('Suco de Goiaba', 'Copo 300 mL', 7.00, 'SUCOS NATURAIS'),
    ('Suco de Maracujá', 'Copo 300 mL', 7.00, 'SUCOS NATURAIS'),
    ('Suco de Laranja', 'Copo 300 mL', 9.00, 'SUCOS NATURAIS'),
    ('Jarra de Suco 1 Litro', '', 23.00, 'SUCOS NATURAIS'),
    ('Açaí', '', 52.00, 'AÇAÍ E GELATOS'),
    ('Gelato', '', 52.00, 'AÇAÍ E GELATOS'),
    ('Heineken Long Neck', '', 13.00, 'CERVEJAS'),
    ('Corona Long Neck', '', 13.00, 'CERVEJAS'),
    ('Stella Long Neck', '', 13.00, 'CERVEJAS'),
    ('Amstel Lata', '', 8.00, 'CERVEJAS'),
    ('Brahma Duplo Malte Buchudinha', '', 7.00, 'CERVEJAS'),
    ('Brahma Duplo Malte 600ml', '', 13.99, 'CERVEJAS'),
    ('Heineken 600ml', '', 17.99, 'CERVEJAS')
)
insert into public.menu_items (
  tenant_id,
  name,
  description,
  price,
  promotional_price,
  category,
  serves_people,
  active
)
select
  tt.tenant_id,
  isrc.name,
  nullif(isrc.description, ''),
  isrc.price,
  null,
  isrc.category,
  1,
  true
from target_tenant tt
cross join item_source isrc
on conflict (tenant_id, name)
do update
set
  description = excluded.description,
  price = excluded.price,
  promotional_price = excluded.promotional_price,
  category = excluded.category,
  serves_people = excluded.serves_people,
  active = true;