import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { UserEntity } from '../users/entities/user.entity';
import { UserRole } from '../access-control/enums/user-role.enum';

/** Map period code → SQL interval + bucket + label format */
const PERIOD_CONFIG: Record<string, { interval: string; bucket: string; labelFmt: string; points: number }> = {
  '1D': { interval: '1 day',    bucket: 'hour',  labelFmt: 'HH24:MI', points: 24  },
  '1W': { interval: '7 days',   bucket: 'day',   labelFmt: 'DD Mon',  points: 7   },
  '1M': { interval: '1 month',  bucket: 'day',   labelFmt: 'DD Mon',  points: 31  },
  '3M': { interval: '3 months', bucket: 'week',  labelFmt: 'DD Mon',  points: 13  },
  '6M': { interval: '6 months', bucket: 'month', labelFmt: 'Mon YY',  points: 6   },
  '1Y': { interval: '1 year',   bucket: 'month', labelFmt: 'Mon YY',  points: 12  },
  '2Y': { interval: '2 years',  bucket: 'month', labelFmt: 'Mon YY',  points: 24  },
  '3Y': { interval: '3 years',  bucket: 'quarter', labelFmt: 'Mon YY', points: 12 },
};

@Injectable()
export class DashboardService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getStats(user: UserEntity): Promise<Record<string, any>> {
    const roleType = user.roleType as UserRole;
    if (roleType === UserRole.SUPER_ADMIN) return this.getSuperAdminStats();
    if (roleType === UserRole.BANK_ADMIN)  return this.getBankAdminStats(user.bankId!);
    if (roleType === UserRole.BRANCH_MANAGER || roleType === UserRole.STAFF)
      return this.getBranchStats(user.bankId!, user.branchId!);
    return this.getCustomerStats(user.id);
  }

  /** Time-series chart data with period filter */
  async getCharts(user: UserEntity, period: string): Promise<Record<string, any>> {
    const cfg = PERIOD_CONFIG[period] ?? PERIOD_CONFIG['1M'];
    const roleType = user.roleType as UserRole;

    if (roleType === UserRole.SUPER_ADMIN) return this.getSuperAdminCharts(cfg);
    if (roleType === UserRole.BANK_ADMIN)  return this.getBankAdminCharts(user.bankId!, cfg);
    return this.getBranchCharts(user.bankId!, user.branchId!, cfg);
  }

  // ─── CHART HELPERS ────────────────────────────────────────────────────────

  private async getSuperAdminCharts(cfg: typeof PERIOD_CONFIG[string]) {
    const [customerGrowth, loanDisbursed, txnVolume, balanceSummary] = await Promise.all([
      this.customerGrowthSeries(cfg, null, null),
      this.loanDisbursedSeries(cfg, null, null),
      this.txnVolumeSeries(cfg, null, null),
      this.balanceSummary(cfg, null, null),
    ]);
    return { period: cfg, customerGrowth, loanDisbursed, txnVolume, balanceSummary };
  }

  private async getBankAdminCharts(bankId: string, cfg: typeof PERIOD_CONFIG[string]) {
    const [customerGrowth, loanDisbursed, txnVolume, balanceSummary] = await Promise.all([
      this.customerGrowthSeries(cfg, bankId, null),
      this.loanDisbursedSeries(cfg, bankId, null),
      this.txnVolumeSeries(cfg, bankId, null),
      this.balanceSummary(cfg, bankId, null),
    ]);
    return { period: cfg, customerGrowth, loanDisbursed, txnVolume, balanceSummary };
  }

  private async getBranchCharts(bankId: string, branchId: string, cfg: typeof PERIOD_CONFIG[string]) {
    const [customerGrowth, loanDisbursed, txnVolume, balanceSummary] = await Promise.all([
      this.customerGrowthSeries(cfg, bankId, branchId),
      this.loanDisbursedSeries(cfg, bankId, branchId),
      this.txnVolumeSeries(cfg, bankId, branchId),
      this.balanceSummary(cfg, bankId, branchId),
    ]);
    return { period: cfg, customerGrowth, loanDisbursed, txnVolume, balanceSummary };
  }

  /** Customer onboarding count per bucket */
  private async customerGrowthSeries(cfg: typeof PERIOD_CONFIG[string], bankId: string | null, branchId: string | null) {
    const where: string[] = [`created_at >= NOW() - INTERVAL '${cfg.interval}'`, `deleted_at IS NULL`];
    const params: any[] = [];
    if (bankId)   { where.push(`"bankId" = $${params.length + 1}`);   params.push(bankId); }
    if (branchId) { where.push(`"branchId" = $${params.length + 1}`); params.push(branchId); }

    const bucketExpr = cfg.bucket === 'quarter'
      ? `DATE_TRUNC('quarter', created_at)`
      : `DATE_TRUNC('${cfg.bucket}', created_at)`;

    const rows = await this.dataSource.query(
      `SELECT TO_CHAR(${bucketExpr}, '${cfg.labelFmt}') as label,
              ${bucketExpr} as bucket_ts,
              COUNT(*) as count
       FROM customers
       WHERE ${where.join(' AND ')}
       GROUP BY bucket_ts ORDER BY bucket_ts`,
      params,
    );
    return rows.map((r: any) => ({ label: r.label, count: +r.count }));
  }

  /** Loan amount disbursed per bucket */
  private async loanDisbursedSeries(cfg: typeof PERIOD_CONFIG[string], bankId: string | null, branchId: string | null) {
    const where: string[] = [`created_at >= NOW() - INTERVAL '${cfg.interval}'`, `status = 'DISBURSED'`, `deleted_at IS NULL`];
    const params: any[] = [];
    if (bankId)   { where.push(`"bankId" = $${params.length + 1}`);   params.push(bankId); }
    if (branchId) { where.push(`"branchId" = $${params.length + 1}`); params.push(branchId); }

    const bucketExpr = cfg.bucket === 'quarter'
      ? `DATE_TRUNC('quarter', created_at)`
      : `DATE_TRUNC('${cfg.bucket}', created_at)`;

    const rows = await this.dataSource.query(
      `SELECT TO_CHAR(${bucketExpr}, '${cfg.labelFmt}') as label,
              ${bucketExpr} as bucket_ts,
              COUNT(*) as count,
              COALESCE(SUM("loanAmount"), 0) as amount
       FROM loan_applications
       WHERE ${where.join(' AND ')}
       GROUP BY bucket_ts ORDER BY bucket_ts`,
      params,
    );
    return rows.map((r: any) => ({ label: r.label, count: +r.count, amount: +r.amount }));
  }

  /** Credit vs Debit transaction volume per bucket */
  private async txnVolumeSeries(cfg: typeof PERIOD_CONFIG[string], bankId: string | null, branchId: string | null) {
    const whereBase: string[] = [`t.created_at >= NOW() - INTERVAL '${cfg.interval}'`, `t.deleted_at IS NULL`];
    const params: any[] = [];

    let joinClause = '';
    if (bankId || branchId) {
      joinClause = `JOIN accounts a ON t."accountId" = a.id JOIN customers c ON a."customerId" = c.id`;
      if (bankId)   { whereBase.push(`c."bankId" = $${params.length + 1}`);   params.push(bankId); }
      if (branchId) { whereBase.push(`c."branchId" = $${params.length + 1}`); params.push(branchId); }
    }

    const bucketExpr = cfg.bucket === 'quarter'
      ? `DATE_TRUNC('quarter', t.created_at)`
      : `DATE_TRUNC('${cfg.bucket}', t.created_at)`;

    const rows = await this.dataSource.query(
      `SELECT TO_CHAR(${bucketExpr}, '${cfg.labelFmt}') as label,
              ${bucketExpr} as bucket_ts,
              t.type,
              COUNT(*) as count,
              COALESCE(SUM(t.amount), 0) as amount
       FROM transactions t ${joinClause}
       WHERE ${whereBase.join(' AND ')}
       GROUP BY bucket_ts, t.type ORDER BY bucket_ts, t.type`,
      params,
    );

    // Merge CREDIT/DEBIT into same label entry
    const merged: Record<string, any> = {};
    for (const r of rows) {
      if (!merged[r.label]) merged[r.label] = { label: r.label, credit: 0, debit: 0, creditAmt: 0, debitAmt: 0 };
      if (r.type === 'CREDIT') { merged[r.label].credit = +r.count; merged[r.label].creditAmt = +r.amount; }
      if (r.type === 'DEBIT')  { merged[r.label].debit  = +r.count; merged[r.label].debitAmt  = +r.amount; }
    }
    return Object.values(merged);
  }

  /** Opening and closing balance for the period */
  private async balanceSummary(cfg: typeof PERIOD_CONFIG[string], bankId: string | null, branchId: string | null) {
    const whereAcc: string[] = [`a.deleted_at IS NULL`];
    const params: any[] = [];
    if (bankId)   { whereAcc.push(`a."bankId" = $${params.length + 1}`);   params.push(bankId); }
    if (branchId) {
      whereAcc.push(`a."branchId" = $${params.length + 1}`); params.push(branchId);
    }

    // Closing balance = sum of all current balances
    const [closing] = await this.dataSource.query(
      `SELECT COALESCE(SUM(a."currentBalance"), 0) as total FROM accounts a WHERE ${whereAcc.join(' AND ')}`,
      params,
    );

    // Net change in period = sum of CREDIT - sum of DEBIT in period
    const txnWhere: string[] = [`t.created_at >= NOW() - INTERVAL '${cfg.interval}'`, `t.deleted_at IS NULL`];
    const txnParams = [...params];
    let joinClause = '';
    if (bankId || branchId) {
      joinClause = `JOIN accounts a ON t."accountId" = a.id JOIN customers c ON a."customerId" = c.id`;
      if (bankId)   txnWhere.push(`c."bankId" = $${txnParams.indexOf(bankId) + 1}`);
      if (branchId) txnWhere.push(`c."branchId" = $${txnParams.indexOf(branchId) + 1}`);
    }

    const netRows = await this.dataSource.query(
      `SELECT t.type, COALESCE(SUM(t.amount), 0) as total
       FROM transactions t ${joinClause}
       WHERE ${txnWhere.join(' AND ')}
       GROUP BY t.type`,
      txnParams,
    );

    let creditInPeriod = 0, debitInPeriod = 0;
    for (const r of netRows) {
      if (r.type === 'CREDIT') creditInPeriod = +r.total;
      if (r.type === 'DEBIT')  debitInPeriod  = +r.total;
    }
    const closingBalance = +closing.total;
    const netChange = creditInPeriod - debitInPeriod;
    const openingBalance = closingBalance - netChange;

    return { openingBalance, closingBalance, creditInPeriod, debitInPeriod, netChange };
  }

  // ─── EXISTING STATS (unchanged) ──────────────────────────────────────────

  private async getSuperAdminStats() {
    const [
      banks, activeBanks, users, branches, customers, accounts,
      loans, bankBreakdown, kycBreakdown, accountTypeBreakdown, monthlyGrowth,
    ] = await Promise.all([
      this.dataSource.query(`SELECT COUNT(*) as count FROM banks`),
      this.dataSource.query(`SELECT COUNT(*) as count FROM banks WHERE is_active = true`),
      this.dataSource.query(`SELECT COUNT(*) as count FROM users WHERE is_active = true`),
      this.dataSource.query(`SELECT COUNT(*) as count FROM branches WHERE is_active = true`),
      this.dataSource.query(`SELECT COUNT(*) as count FROM customers WHERE is_active = true`),
      this.dataSource.query(`SELECT COUNT(*) as count FROM accounts`),
      this.dataSource.query(`SELECT status, COUNT(*) as count FROM loan_applications GROUP BY status`),
      this.dataSource.query(
        `SELECT b.id, b.name,
          (SELECT COUNT(*) FROM branches br WHERE br."bankId" = b.id AND br.is_active) as branches,
          (SELECT COUNT(*) FROM customers c WHERE c."bankId" = b.id AND c.is_active) as customers
        FROM banks b WHERE b.is_active = true ORDER BY customers DESC LIMIT 8`
      ),
      this.dataSource.query(`SELECT kyc_status, COUNT(*) as count FROM customers GROUP BY kyc_status`),
      this.dataSource.query(`SELECT "accountType", COUNT(*) as count FROM accounts GROUP BY "accountType" ORDER BY count DESC`),
      this.dataSource.query(
        `SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'Mon') as month,
                COUNT(*) as count
         FROM customers
         WHERE created_at >= NOW() - INTERVAL '7 months'
         GROUP BY DATE_TRUNC('month', created_at)
         ORDER BY DATE_TRUNC('month', created_at)`
      ),
    ]);
    return {
      scope: 'SUPER_ADMIN',
      totalBanks: +banks[0].count,
      activeBanks: +activeBanks[0].count,
      totalActiveUsers: +users[0].count,
      totalBranches: +branches[0].count,
      totalCustomers: +customers[0].count,
      totalAccounts: +accounts[0].count,
      loansByStatus: loans.reduce((a: any, r: any) => { a[r.status] = +r.count; return a; }, {}),
      bankBreakdown: bankBreakdown.map((b: any) => ({ id: b.id, name: b.name, branches: +b.branches, customers: +b.customers })),
      kycBreakdown: kycBreakdown.reduce((a: any, r: any) => { a[r.kyc_status] = +r.count; return a; }, {}),
      accountTypeBreakdown: accountTypeBreakdown.map((r: any) => ({ type: r.accountType, count: +r.count })),
      monthlyGrowth: monthlyGrowth.map((r: any) => ({ month: r.month, count: +r.count })),
    };
  }

  private async getBankAdminStats(bankId: string) {
    const [
      branches, customers, staff, accounts, loans,
      branchBreakdown, kycBreakdown, accountTypeBreakdown, monthlyGrowth,
    ] = await Promise.all([
      this.dataSource.query(`SELECT COUNT(*) as count FROM branches WHERE "bankId" = $1 AND is_active = true`, [bankId]),
      this.dataSource.query(`SELECT COUNT(*) as count FROM customers WHERE "bankId" = $1 AND is_active = true`, [bankId]),
      this.dataSource.query(`SELECT COUNT(*) as count FROM users WHERE "bankId" = $1 AND is_active = true`, [bankId]),
      this.dataSource.query(`SELECT COUNT(*) as count FROM accounts a JOIN customers c ON a."customerId" = c.id WHERE c."bankId" = $1`, [bankId]),
      this.dataSource.query(`SELECT status, COUNT(*) as count FROM loan_applications WHERE "bankId" = $1 GROUP BY status`, [bankId]),
      this.dataSource.query(
        `SELECT br.id, br.name,
          (SELECT COUNT(*) FROM customers c WHERE c."branchId" = br.id AND c.is_active) as customers,
          (SELECT COUNT(*) FROM loan_applications l WHERE l."branchId" = br.id) as loans
         FROM branches br WHERE br."bankId" = $1 AND br.is_active = true ORDER BY customers DESC LIMIT 8`,
        [bankId],
      ),
      this.dataSource.query(`SELECT kyc_status, COUNT(*) as count FROM customers WHERE "bankId" = $1 GROUP BY kyc_status`, [bankId]),
      this.dataSource.query(
        `SELECT a."accountType", COUNT(*) as count FROM accounts a JOIN customers c ON a."customerId" = c.id WHERE c."bankId" = $1 GROUP BY a."accountType" ORDER BY count DESC`,
        [bankId],
      ),
      this.dataSource.query(
        `SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'Mon') as month, COUNT(*) as count
         FROM customers WHERE "bankId" = $1 AND created_at >= NOW() - INTERVAL '7 months'
         GROUP BY DATE_TRUNC('month', created_at) ORDER BY DATE_TRUNC('month', created_at)`,
        [bankId],
      ),
    ]);
    return {
      scope: 'BANK_ADMIN',
      totalBranches: +branches[0].count,
      totalCustomers: +customers[0].count,
      totalStaff: +staff[0].count,
      totalAccounts: +accounts[0].count,
      loansByStatus: loans.reduce((a: any, r: any) => { a[r.status] = +r.count; return a; }, {}),
      branchBreakdown: branchBreakdown.map((b: any) => ({ id: b.id, name: b.name, customers: +b.customers, loans: +b.loans })),
      kycBreakdown: kycBreakdown.reduce((a: any, r: any) => { a[r.kyc_status] = +r.count; return a; }, {}),
      accountTypeBreakdown: accountTypeBreakdown.map((r: any) => ({ type: r.accountType, count: +r.count })),
      monthlyGrowth: monthlyGrowth.map((r: any) => ({ month: r.month, count: +r.count })),
    };
  }

  private async getBranchStats(bankId: string, branchId: string) {
    const [customers, accounts, loans, pending, kycBreakdown, accountTypeBreakdown, monthlyGrowth] =
      await Promise.all([
        this.dataSource.query(`SELECT COUNT(*) as count FROM customers WHERE "bankId" = $1 AND "branchId" = $2 AND is_active = true`, [bankId, branchId]),
        this.dataSource.query(`SELECT COUNT(*) as count FROM accounts a JOIN customers c ON a."customerId" = c.id WHERE c."branchId" = $1`, [branchId]),
        this.dataSource.query(`SELECT COUNT(*) as count FROM loan_applications WHERE "bankId" = $1 AND "branchId" = $2`, [bankId, branchId]),
        this.dataSource.query(`SELECT COUNT(*) as count FROM loan_applications WHERE "bankId" = $1 AND "branchId" = $2 AND status = 'PENDING'`, [bankId, branchId]),
        this.dataSource.query(`SELECT kyc_status, COUNT(*) as count FROM customers WHERE "branchId" = $1 GROUP BY kyc_status`, [branchId]),
        this.dataSource.query(
          `SELECT a."accountType", COUNT(*) as count FROM accounts a JOIN customers c ON a."customerId" = c.id WHERE c."branchId" = $1 GROUP BY a."accountType" ORDER BY count DESC`,
          [branchId],
        ),
        this.dataSource.query(
          `SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'Mon') as month, COUNT(*) as count
           FROM customers WHERE "branchId" = $1 AND created_at >= NOW() - INTERVAL '7 months'
           GROUP BY DATE_TRUNC('month', created_at) ORDER BY DATE_TRUNC('month', created_at)`,
          [branchId],
        ),
      ]);
    return {
      scope: 'BRANCH',
      totalCustomers: +customers[0].count,
      totalAccounts: +accounts[0].count,
      totalLoans: +loans[0].count,
      pendingApprovals: +pending[0].count,
      kycBreakdown: kycBreakdown.reduce((a: any, r: any) => { a[r.kyc_status] = +r.count; return a; }, {}),
      accountTypeBreakdown: accountTypeBreakdown.map((r: any) => ({ type: r.accountType, count: +r.count })),
      monthlyGrowth: monthlyGrowth.map((r: any) => ({ month: r.month, count: +r.count })),
    };
  }

  private async getCustomerStats(userId: string) {
    const [accounts, loans] = await Promise.all([
      this.dataSource.query(`SELECT COUNT(*) as count FROM accounts WHERE "customerId" = $1`, [userId]),
      this.dataSource.query(`SELECT status, COUNT(*) as count FROM loan_applications WHERE maker_id = $1 GROUP BY status`, [userId]),
    ]);
    return {
      scope: 'CUSTOMER',
      totalAccounts: +accounts[0].count,
      loansByStatus: loans.reduce((a: any, r: any) => { a[r.status] = +r.count; return a; }, {}),
    };
  }
}
