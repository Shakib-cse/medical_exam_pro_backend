import { BaseModule } from "../../core/BaseModule";
import { CouponService } from "./CouponService";
import { CouponController } from "./CouponController";
import { createCouponRoutes } from "./couponRoutes";

export class CouponModule extends BaseModule {
  public readonly name = "CouponModule";
  public readonly version = "1.0.0";
  public readonly basePath = "/api/v1/coupons";
  public readonly dependencies = [];

  protected async setupUseCases(): Promise<void> {
    const prisma = this.context.getService("prisma");
    const couponService = new CouponService(prisma);
    this.registerService("CouponService", couponService);
  }

  protected async setupControllers(): Promise<void> {
    const couponService = this.getService<CouponService>("CouponService");
    const couponController = new CouponController(couponService);
    this.registerController("CouponController", couponController);
  }

  protected async setupRoutes(): Promise<void> {
    const couponController = this.getController<CouponController>("CouponController");
    const routes = createCouponRoutes(couponController);
    this.router.use("/", routes);
  }
}
