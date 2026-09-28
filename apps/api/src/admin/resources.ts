import type { ResourceWithOptions } from 'adminjs';
import type { DatabaseMetadata } from '@adminjs/sql';

// Описание таблиц для админки. Имена — как в базе (Prisma мапит каталог в snake_case,
// а User/Role/Project остаются с заглавной). Типы импортируются только как типы:
// в рантайме этих пакетов здесь нет, они ESM.

const READONLY = { isVisible: { list: true, show: true, edit: false, filter: true } };
const HIDDEN = { isVisible: false };

/** Служебные поля есть у всех таблиц: показываем, но не даём править */
const timestamps = (created = 'created_at', updated = 'updated_at') => ({
  [created]: { ...READONLY, position: 100 },
  [updated]: { ...READONLY, position: 101 },
});

export function adminResources(db: DatabaseMetadata): ResourceWithOptions[] {
  return [
    {
      resource: db.table('product'),
      options: {
        id: 'product',
        navigation: { name: 'Каталог', icon: 'Box' },
        listProperties: ['name', 'type', 'category', 'status', 'price', 'ugt', 'verified'],
        editProperties: [
          'name',
          'type',
          'subtype',
          'category',
          'description',
          'price',
          'ugt',
          'market_potential',
          'status',
          'company_id',
          'specs',
          'source_url',
          'source_date',
          'verified',
          'catalog_version',
        ],
        filterProperties: ['name', 'type', 'category', 'status', 'verified', 'company_id'],
        properties: {
          product_id: { ...READONLY, position: 0 },
          name: { isTitle: true, position: 1 },
          type: {
            availableValues: [
              { value: 'brs', label: 'БРС — наземные и морские' },
              { value: 'bas', label: 'БАС — авиационные' },
              { value: 'software', label: 'ПО' },
            ],
          },
          status: {
            availableValues: [
              { value: 'operation', label: 'В эксплуатации' },
              { value: 'piloting', label: 'Пилотирование' },
              { value: 'rnd', label: 'НИОКР' },
            ],
          },
          description: { type: 'textarea' },
          // ТТХ: jsonb, редактор «ключ — значение» (структура полей — docs/team/VIZ_INPUTS.md).
          // Строкой его показать нельзя: textarea-редактор AdminJS зовёт value.match() и падает на объекте.
          specs: { type: 'key-value' },
          ...timestamps(),
        },
      },
    },
    {
      resource: db.table('company'),
      options: {
        id: 'company',
        navigation: { name: 'Каталог', icon: 'Briefcase' },
        listProperties: ['name', 'region', 'company_type', 'inn', 'website'],
        properties: {
          company_id: { ...READONLY, position: 0 },
          name: { isTitle: true, position: 1 },
          ...timestamps(),
        },
      },
    },
    {
      resource: db.table('industry'),
      options: {
        id: 'industry',
        navigation: { name: 'Каталог', icon: 'Grid' },
        listProperties: ['name', 'created_at'],
        properties: {
          industry_id: { ...READONLY, position: 0 },
          name: { isTitle: true, position: 1 },
          ...timestamps(),
        },
      },
    },
    {
      resource: db.table('scenario'),
      options: {
        id: 'scenario',
        navigation: { name: 'Каталог', icon: 'Activity' },
        listProperties: ['name', 'description'],
        properties: {
          scenario_id: { ...READONLY, position: 0 },
          name: { isTitle: true, position: 1 },
          description: { type: 'textarea' },
          ...timestamps(),
        },
      },
    },
    {
      resource: db.table('case'),
      options: {
        id: 'case',
        navigation: { name: 'Каталог', icon: 'FileText' },
        listProperties: ['title', 'customer', 'region', 'product_id'],
        properties: {
          case_id: { ...READONLY, position: 0 },
          title: { isTitle: true, position: 1 },
          description: { type: 'textarea' },
          result_metrics: { type: 'textarea' },
          ...timestamps(),
        },
      },
    },
    {
      resource: db.table('product_industry'),
      options: {
        id: 'product_industry',
        navigation: { name: 'Связи', icon: 'Link' },
      },
    },
    {
      resource: db.table('product_scenario'),
      options: {
        id: 'product_scenario',
        navigation: { name: 'Связи', icon: 'Link' },
      },
    },
    {
      resource: db.table('project'),
      options: {
        id: 'project',
        navigation: { name: 'Расчёты', icon: 'TrendingUp' },
        // Расчёты правит их владелец в приложении — админке только просмотр
        actions: { new: { isAccessible: false }, edit: { isAccessible: false } },
        listProperties: ['name', 'object_type', 'robots_count', 'capex', 'payback_years', 'roi_percent', 'updated_at'],
        properties: {
          id: { ...READONLY, position: 0 },
          name: { isTitle: true, position: 1 },
          params: { type: 'key-value' },
          econ: { type: 'key-value' },
          norms: { type: 'key-value' },
          ...timestamps(),
        },
      },
    },
    {
      resource: db.table('User'),
      options: {
        id: 'User',
        navigation: { name: 'Пользователи', icon: 'Users' },
        listProperties: ['email', 'name', 'createdAt'],
        editProperties: ['email', 'name', 'avatar'],
        properties: {
          id: { ...READONLY, position: 0 },
          email: { isTitle: true, position: 1 },
          // Хеш пароля не показываем и не даём править: смена пароля — через приложение
          password: HIDDEN,
          ...timestamps('createdAt', 'updatedAt'),
        },
      },
    },
    {
      resource: db.table('Role'),
      options: {
        id: 'Role',
        navigation: { name: 'Пользователи', icon: 'Shield' },
        listProperties: ['name', 'description', 'priority'],
        properties: {
          id: { ...READONLY, position: 0 },
          name: { isTitle: true, position: 1 },
          ...timestamps('createdAt', 'updatedAt'),
        },
      },
    },
    {
      resource: db.table('UserRole'),
      options: {
        id: 'UserRole',
        navigation: { name: 'Пользователи', icon: 'UserCheck' },
        listProperties: ['userId', 'roleId', 'createdAt'],
        properties: {
          id: { ...READONLY, position: 0 },
          ...timestamps('createdAt', 'updatedAt'),
        },
      },
    },
  ];
}
