import { Customer } from '../models';
import { AppError } from '../utils/errors';
import { CreateCustomerInput } from '../validation/customer.schema';

export async function listCustomers(): Promise<Customer[]> {
  return Customer.findAll({ order: [['name', 'ASC']] });
}

export async function getCustomer(id: number): Promise<Customer> {
  const customer = await Customer.findByPk(id);
  if (!customer) throw new AppError(404, `Customer ${id} not found`);
  return customer;
}

export async function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  const existing = await Customer.findOne({ where: { email: input.email } });
  if (existing) {
    throw new AppError(409, `A customer with email ${input.email} already exists`);
  }
  // A concurrent duplicate still hits the DB unique key -> 409 via the error handler.
  return Customer.create({
    name: input.name,
    email: input.email,
    phone: input.phone,
    gstNumber: input.gstNumber,
  });
}