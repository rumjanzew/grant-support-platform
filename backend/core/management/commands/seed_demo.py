from datetime import date, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from core.models import (
    Application,
    AuditLog,
    ExpertAssignment,
    ExpertiseReport,
    Grant,
    Organization,
    Role,
    User,
)


DEMO_PASSWORD = "DemoPass2026!"


class Command(BaseCommand):
    help = "Создаёт идемпотентный набор данных для локальной разработки и демонстрации."

    @transaction.atomic
    def handle(self, *args, **options):
        created = {
            "roles": 0,
            "users": 0,
            "organizations": 0,
            "grants": 0,
            "applications": 0,
            "assignments": 0,
            "reports": 0,
            "audit_logs": 0,
        }
        now = timezone.now()
        today = timezone.localdate()

        roles = {}
        role_descriptions = {
            Role.Name.APPLICANT: "Заявитель грантовой поддержки",
            Role.Name.EXPERT: "Эксперт по рассмотрению заявок",
            Role.Name.ADMINISTRATOR: "Администратор платформы",
        }
        for role_name, description in role_descriptions.items():
            role, was_created = Role.objects.update_or_create(
                name=role_name,
                defaults={"description": description},
            )
            roles[role_name] = role
            created["roles"] += int(was_created)

        organization_specs = [
            {
                "inn": "0000000001",
                "name": "АНО «Северная инициатива»",
                "ogrn": "1000000000001",
                "organization_type": "НКО",
                "registration_date": date(2021, 4, 12),
                "city": "Сыктывкар",
                "street": "Лесная",
                "house": "14",
                "postal_code": "167000",
            },
            {
                "inn": "0000000002",
                "name": "ООО «Коми Диджитал Лаб»",
                "ogrn": "1000000000002",
                "organization_type": "МСП",
                "registration_date": date(2022, 8, 3),
                "city": "Ухта",
                "street": "Таёжная",
                "house": "7",
                "postal_code": "169300",
            },
            {
                "inn": "0000000003",
                "name": "КФХ «Зелёная Парма»",
                "ogrn": "1000000000003",
                "organization_type": "МСП",
                "registration_date": date(2020, 2, 20),
                "city": "Корткерос",
                "street": "Центральная",
                "house": "25",
                "postal_code": "168020",
            },
        ]
        organizations = []
        for spec in organization_specs:
            inn = spec["inn"]
            organization, was_created = Organization.objects.update_or_create(
                inn=inn,
                defaults={**spec, "status": Organization.Status.ACTIVE, "kpp": ""},
            )
            organizations.append(organization)
            created["organizations"] += int(was_created)

        user_specs = [
            {
                "email": "admin@example.com",
                "role": roles[Role.Name.ADMINISTRATOR],
                "first_name": "Анна",
                "last_name": "Администраторова",
                "middle_name": "Сергеевна",
                "phone": "+7 900 000-00-01",
                "organization": None,
                "is_staff": True,
                "is_superuser": True,
            },
            {
                "email": "expert@example.com",
                "role": roles[Role.Name.EXPERT],
                "first_name": "Елена",
                "last_name": "Экспертова",
                "middle_name": "Игоревна",
                "phone": "+7 900 000-00-02",
                "organization": None,
                "is_staff": False,
                "is_superuser": False,
            },
            {
                "email": "applicant@example.com",
                "role": roles[Role.Name.APPLICANT],
                "first_name": "Иван",
                "last_name": "Заявителев",
                "middle_name": "Петрович",
                "phone": "+7 900 000-00-03",
                "organization": organizations[0],
                "is_staff": False,
                "is_superuser": False,
            },
        ]
        users = {}
        for spec in user_specs:
            email = spec["email"]
            user, was_created = User.objects.update_or_create(
                email=email,
                defaults={
                    **spec,
                    "status": User.Status.ACTIVE,
                    "is_active": True,
                },
            )
            if not user.check_password(DEMO_PASSWORD):
                user.set_password(DEMO_PASSWORD)
                update_fields = ["password", "updated_at"]
                if email == "applicant@example.com" and user.consent_pd_agreed_at is None:
                    user.consent_pd_agreed_at = now
                    update_fields.append("consent_pd_agreed_at")
                user.save(update_fields=update_fields)
            users[email] = user
            created["users"] += int(was_created)

        administrator = users["admin@example.com"]
        expert = users["expert@example.com"]
        grant_specs = [
            ("DEMO-BUSINESS", "Старт малого бизнеса в Республике Коми", "Поддержка малого бизнеса", "Финансирование запуска новых производств и сервисных компаний с устойчивой моделью развития.", Decimal("1200000"), today - timedelta(days=10), today + timedelta(days=45), Grant.Status.OPEN),
            ("DEMO-NKO", "Социальные проекты для местных сообществ", "Социальные проекты НКО", "Поддержка инициатив НКО в сфере добровольчества, инклюзии и развития общественных пространств.", Decimal("900000"), today - timedelta(days=5), today + timedelta(days=35), Grant.Status.OPEN),
            ("DEMO-YOUTH", "Молодёжное предпринимательство: первый проект", "Молодёжное предпринимательство", "Гранты на проверку бизнес-гипотез и создание первых рабочих мест молодыми предпринимателями.", Decimal("650000"), today - timedelta(days=3), today + timedelta(days=28), Grant.Status.OPEN),
            ("DEMO-DIGITAL", "Цифровая трансформация предприятий", "Цифровизация бизнеса", "Софинансирование внедрения отечественных цифровых решений, электронной торговли и автоматизации процессов.", Decimal("2000000"), today + timedelta(days=7), today + timedelta(days=60), Grant.Status.PUBLISHED),
            ("DEMO-TOURISM", "Новые туристические маршруты Коми", "Туризм в Республике Коми", "Поддержка безопасных туристических продуктов, гостевой инфраструктуры и продвижения локальных маршрутов.", Decimal("1800000"), today - timedelta(days=15), today + timedelta(days=20), Grant.Status.OPEN),
            ("DEMO-ECO", "Экологические инициативы территорий", "Экологические инициативы", "Проекты по экологическому просвещению, раздельному сбору и восстановлению природных территорий.", Decimal("750000"), today - timedelta(days=90), today - timedelta(days=20), Grant.Status.CLOSED),
            ("DEMO-RURAL", "Развитие сервисов в сельских территориях", "Развитие сельских территорий", "Поддержка локальных услуг, кооперации и занятости жителей отдалённых населённых пунктов.", Decimal("1400000"), today - timedelta(days=180), today - timedelta(days=90), Grant.Status.ARCHIVED),
            ("DEMO-CREATIVE", "Креативные индустрии: идеи и продукты", "Креативные индустрии", "Будущая программа для дизайн-студий, ремесленных мастерских и создателей цифрового контента.", Decimal("1100000"), today + timedelta(days=30), today + timedelta(days=90), Grant.Status.DRAFT),
        ]
        grants = {}
        for code, title, category, description, amount, start_date, end_date, status in grant_specs:
            grant, was_created = Grant.objects.update_or_create(
                code=code,
                defaults={
                    "title": title,
                    "category": category,
                    "description": description,
                    "max_amount": amount,
                    "start_date": start_date,
                    "end_date": end_date,
                    "status": status,
                    "created_by": administrator,
                },
            )
            grants[code] = grant
            created["grants"] += int(was_created)

        year = today.year
        application_specs = [
            (organizations[0], grants["DEMO-BUSINESS"], "Мастерская локальных товаров", "Создание мастерской сувенирной продукции из экологичных материалов с рабочими местами для жителей Сыктывкара.", Decimal("780000"), Application.Status.DRAFT, None, None),
            (organizations[1], grants["DEMO-DIGITAL"], "Цифровой кабинет поставщика", "Разработка личного кабинета для автоматизации заказов и взаимодействия малых поставщиков с заказчиками.", Decimal("1450000"), Application.Status.SUBMITTED, f"GR-{year}-90001", now - timedelta(days=4)),
            (organizations[0], grants["DEMO-NKO"], "Школа общественных инициатив", "Образовательная программа для команд НКО и добровольцев из муниципальных районов Республики Коми.", Decimal("620000"), Application.Status.UNDER_REVIEW, f"GR-{year}-90002", now - timedelta(days=8)),
            (organizations[1], grants["DEMO-YOUTH"], "Мобильная студия для молодых авторов", "Комплект оборудования и программа наставничества для запуска молодёжных медиапроектов.", Decimal("490000"), Application.Status.REVISION_REQUIRED, f"GR-{year}-90003", now - timedelta(days=15)),
            (organizations[2], grants["DEMO-TOURISM"], "Гостевой маршрут «Тропами Пармы»", "Создание круглогодичного маршрута с участием сельских гостевых домов и локальных производителей.", Decimal("1250000"), Application.Status.APPROVED, f"GR-{year}-90004", now - timedelta(days=24)),
            (organizations[2], grants["DEMO-ECO"], "Экологический патруль села", "Система общественного мониторинга, просветительских встреч и небольших природоохранных акций.", Decimal("540000"), Application.Status.REJECTED, f"GR-{year}-90005", now - timedelta(days=35)),
        ]
        applications = {}
        for organization, grant, project_name, description, amount, status, number, submitted_at in application_specs:
            application, was_created = Application.objects.update_or_create(
                organization=organization,
                project_name=project_name,
                defaults={
                    "grant": grant,
                    "description": description,
                    "requested_amount": amount,
                    "status": status,
                    "application_number": number,
                    "submitted_at": submitted_at,
                    "review_deadline": submitted_at + timedelta(days=30) if submitted_at else None,
                    "version": 2 if status == Application.Status.REVISION_REQUIRED else 1,
                },
            )
            applications[status] = application
            created["applications"] += int(was_created)

        assignment_specs = [
            (Application.Status.UNDER_REVIEW, ExpertAssignment.Status.ACTIVE),
            (Application.Status.APPROVED, ExpertAssignment.Status.COMPLETED),
            (Application.Status.REJECTED, ExpertAssignment.Status.COMPLETED),
        ]
        assignments = {}
        for application_status, assignment_status in assignment_specs:
            assignment, was_created = ExpertAssignment.objects.update_or_create(
                application=applications[application_status],
                expert=expert,
                defaults={
                    "assigned_by": administrator,
                    "status": assignment_status,
                },
            )
            assignments[application_status] = assignment
            created["assignments"] += int(was_created)

        report_specs = [
            (Application.Status.UNDER_REVIEW, 78, "Черновик: уточнить календарный план и показатели охвата.", "", True, None),
            (Application.Status.APPROVED, 92, "Проект хорошо проработан, бюджет обоснован, ожидаемый эффект измерим.", ExpertiseReport.Decision.APPROVED, False, now - timedelta(days=10)),
            (Application.Status.REJECTED, 48, "Недостаточно раскрыта модель устойчивости проекта и отсутствует подтверждение части расходов.", ExpertiseReport.Decision.REJECTED, False, now - timedelta(days=20)),
        ]
        for application_status, score, comment, decision, draft, submitted_at in report_specs:
            assignment = assignments[application_status]
            _, was_created = ExpertiseReport.objects.update_or_create(
                assignment=assignment,
                defaults={
                    "application": assignment.application,
                    "expert": expert,
                    "score": score,
                    "comment": comment,
                    "decision": decision,
                    "draft": draft,
                    "submitted_at": submitted_at,
                },
            )
            created["reports"] += int(was_created)

        audit_specs = [
            (administrator, "grant.created", "grant", grants["DEMO-BUSINESS"], {"status": Grant.Status.OPEN}),
            (users["applicant@example.com"], "application.submitted", "application", applications[Application.Status.SUBMITTED], {"status": Application.Status.SUBMITTED}),
            (administrator, "expert.assigned", "application", applications[Application.Status.UNDER_REVIEW], {"expert_id": str(expert.id)}),
            (expert, "expert.decision", "application", applications[Application.Status.APPROVED], {"decision": ExpertiseReport.Decision.APPROVED, "score": 92}),
            (expert, "expert.decision", "application", applications[Application.Status.REJECTED], {"decision": ExpertiseReport.Decision.REJECTED, "score": 48}),
        ]
        for user, action, entity_type, entity, metadata in audit_specs:
            tagged_metadata = {**metadata, "source": "seed_demo"}
            _, was_created = AuditLog.objects.get_or_create(
                action=action,
                entity_type=entity_type,
                entity_id=entity.id,
                metadata=tagged_metadata,
                defaults={
                    "user": user,
                    "ip_address": "127.0.0.1",
                    "user_agent": "Django seed_demo management command",
                },
            )
            created["audit_logs"] += int(was_created)

        self.stdout.write(self.style.SUCCESS("Демонстрационные данные готовы."))
        self.stdout.write(
            "Создано при этом запуске: "
            + ", ".join(f"{name}={count}" for name, count in created.items())
        )
        self.stdout.write(
            "Итого demo: users=3, organizations=3, grants=8, "
            "applications=6, assignments=3, reports=3, audit_logs=5"
        )
        self.stdout.write("\nТестовые учётные записи:")
        self.stdout.write("  Administrator: admin@example.com")
        self.stdout.write("  Expert:        expert@example.com")
        self.stdout.write("  Applicant:     applicant@example.com")
        self.stdout.write(f"  Пароль:        {DEMO_PASSWORD}")
        self.stdout.write("\nКоманда предназначена только для local development/demo.")
