-- Stage 2 compatibility fix: gmp_sale_lines.line_total is a generated column.
do $migration$
declare
  oidv oid;
  ddl text;
begin
  oidv := to_regprocedure('public.gmp_create_and_post_sale(uuid,uuid,uuid,uuid,text,text,jsonb)');
  if oidv is null then raise exception 'sale_function_not_found'; end if;
  ddl := pg_get_functiondef(oidv);
  ddl := replace(
    ddl,
    'insert into public.gmp_sale_lines(sale_id,product_id,quantity,weight_grams,unit_price,making_charge,discount_amount,vat_amount,line_total) values(v_sale_id,v_product,v_qty,v_weight,v_unit_price,v_making,v_discount,v_line_vat,v_line_total);',
    'insert into public.gmp_sale_lines(sale_id,product_id,quantity,weight_grams,unit_price,making_charge,discount_amount,vat_amount) values(v_sale_id,v_product,v_qty,v_weight,v_unit_price,v_making,v_discount,v_line_vat);'
  );
  execute ddl;
end;
$migration$;
